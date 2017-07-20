import global from '@dojo/core/global';
import WeakMap from '@dojo/shim/WeakMap';
import MetaBase from '../meta/Base';

import 'intersection-observer';

interface IntersectionDetail {
	callback?: IntersectionMetaCallback;
	entries: WeakMap<Element, IntersectionObserverEntry>;
	intersections: { [key: string]: number }; // previous intersections
	intersectionObserver?: IntersectionObserver; // attached observer
	keys: { [key: string]: number }; // subscribed keys and their counts
	observer: IntersectionMetaObserver;
	root: string;
	rootMargin?: string;
	thresholds: number[]; // thresholds the observe should be attached with
}

export interface IntersectionMetaCallback {
	(intersectionEntries: IntersectionMetaEntry[], observer: IntersectionMetaObserver): void;
}

export interface IntersectionMetaEntry {
	key: string;
	previousIntersectionRatio: number;
	intersectionRatio: number;
}

export interface IntersectionMetaOptions {
	root?: string;
	rootMargin?: string;
	step?: number;
	threshold?: number;
	thresholds?: number[];
}

export interface IntersectionMetaObserver {
	subscribe(key: string): void;
	unsubscribe(key: string): void;
}

export class Intersection extends MetaBase {
	private _observers = new WeakMap<IntersectionMetaObserver, IntersectionDetail>();
	private _intersectionObservers = new WeakMap<IntersectionObserver, IntersectionDetail>();

	private _getIntersectionObserver(details: IntersectionDetail, rootNode?: Element): IntersectionObserver {
		if (details.intersectionObserver) {
			return details.intersectionObserver;
		}

		const {
			rootMargin = '0px',
			thresholds
		} = details;

		const options: IntersectionObserverInit = {
			rootMargin,
			threshold: thresholds.length ? thresholds : 0.000001
		};
		if (rootNode) {
			options.root = rootNode;
		}
		// console.log('Intersection._getIntersectionObserver', details.root, options);
		const observer = new global.IntersectionObserver(this._onIntersect.bind(this), options);
		details.intersectionObserver = observer;
		this._intersectionObservers.set(observer, details);
		return observer;
	}

	private _subscribe(detail: IntersectionDetail, key?: string) {
		this._ubscribe(detail, key);
	}

	private _unsubscribe(detail: IntersectionDetail, key: string) {
		this._ubscribe(detail, key, true);
	}

	private _ubscribe(detail: IntersectionDetail, key?: string, unsubscribe = false): void {
		const {
			keys,
			root
		} = detail;

		if (key) {
			keys[key] = (keys[key] || 0) + 1;
		}

		const withIntersectionObserver = key ? (intersectionObserver: IntersectionObserver) => {
			const node = this.nodes.get(key);
			if (node) {
				this._observe(intersectionObserver, node, unsubscribe);
			}
			else {
				this.requireNode(key, (node) => {
					this._observe(intersectionObserver, node, unsubscribe);
				});
			}
		} : undefined;

		if (root) {
			const withRootNode = (rootNode: Element) => {
				const intersectionObserver = this._getIntersectionObserver(detail, rootNode);
				withIntersectionObserver && withIntersectionObserver(intersectionObserver);
			};

			const rootNode = this.nodes.get(root);
			if (rootNode) {
				withRootNode(rootNode);
			}
			else {
				this.requireNode(root, withRootNode);
			}
		}
		else {
			const intersectionObserver = this._getIntersectionObserver(detail);
			withIntersectionObserver && withIntersectionObserver(intersectionObserver);
		}
	}

	private _observe(observer: IntersectionObserver, node: Element, unsubscribe = false) {
		if (unsubscribe) {
			observer.unobserve(node);
		}
		else {
			observer.observe(node);
			if (typeof (<any> observer)._checkForIntersections === 'function') {
				(<any> observer)._checkForIntersections();
			}
		}
	}

	private _onIntersect(intersectionObserverEntries: IntersectionObserverEntry[], intersectionObserver: IntersectionObserver) {
		if (this._intersectionObservers.has(intersectionObserver)) {
			const details = this._intersectionObservers.get(intersectionObserver);
			if (details) {
				const intersectionDetails: IntersectionMetaEntry[] = [];
				for (const intersectionEntry of intersectionObserverEntries) {
					details.entries.set(intersectionEntry.target, intersectionEntry);
					const intersectionRatio = intersectionEntry.intersectionRatio;
					for (const key in details.keys) {
						if (this.nodes.get(key) === intersectionEntry.target) {
							const previousIntersectionRatio = details.intersections[key] || 0;
							details.intersections[key] = intersectionRatio;
							intersectionDetails.push({
								intersectionRatio,
								key,
								previousIntersectionRatio
							});
						}
					}
				}
				details.callback && details.callback(intersectionDetails, details.observer);
			}
		}
	}

	public has(key: string, observer: IntersectionMetaObserver): boolean {
		const details = this._observers.get(observer);
		return (details ? typeof details.intersections[key] === 'number' : false);
	}

	public get(key: string, observer: IntersectionMetaObserver): number {
		const details = this._observers.get(observer);
		if (details) {
			const intersectionObserver = details.intersectionObserver;
			if (intersectionObserver) {
				const entries = intersectionObserver.takeRecords();
				if (entries.length) {
					this._onIntersect(entries, intersectionObserver);
				}
			}
			if (typeof details.intersections[key] === 'number') {
				return details.intersections[key];
			}
		}

		return 0;
	}

	public observe(callback: IntersectionMetaCallback, { root = '', rootMargin = '0px', step, threshold, thresholds = [] }: IntersectionMetaOptions = {}): IntersectionMetaObserver {
		if (typeof step === 'number') {
			thresholds.length = 0;
			const steps = Math.floor(1 / step);
			for (let i = 0; i <= steps; i ++) {
				thresholds.push(step * i);
			}
		}
		if (typeof threshold === 'number') {
			thresholds = [ threshold ];
		}
		const keys: { [key: string]: number } = {};

		const observer: IntersectionMetaObserver = {
			subscribe: (key: string): void => {
				this._subscribe(details, key);
			},
			unsubscribe: (key: string): void => {
				const count = (keys[key] || 0) - 1;
				if (count > 0) {
					keys[key] = count;
				}
				else {
					delete keys[key];
					this._unsubscribe(details, key);
				}
			}
		};

		const details: IntersectionDetail = {
			callback,
			entries: new WeakMap<Element, IntersectionObserverEntry>(),
			intersections: {},
			keys,
			observer,
			root,
			rootMargin,
			thresholds
		};

		if (root) {
			this.requireNode(root, (rootNode) => {
				this._getIntersectionObserver(details, rootNode);
			});
		}
		else {
			this._getIntersectionObserver(details);
		}

		this._observers.set(observer, details);

		return observer;
	}
}

export default Intersection;
