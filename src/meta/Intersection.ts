import global from '@dojo/core/global';
import { from } from '@dojo/shim/array';
import Map from '@dojo/shim/Map';
import Set from '@dojo/shim/Set';
import WeakMap from '@dojo/shim/WeakMap';
import MetaBase from '../meta/Base';

import 'intersection-observer';

export const enum IntersectionWatchType {
	LESS_THAN,
	GREATER_THAN,
	WITHIN,
	OUTSIDE,
	NEVER,
	STEP,
	THRESHOLDS,
	ANY
}

interface IntersectionWatchOptions {
	key: string;
	thresholds: number[];
	type: IntersectionWatchType;
}

interface IntersectionDetails {
	entries: WeakMap<Element, IntersectionObserverEntry>;
	observer?: IntersectionObserver;
	observerThresholds: Set<number>;
	thresholds: Set<number>;
	watches: IntersectionWatchOptions[];
}

export class Intersection extends MetaBase {
	private _roots = new Map<string, IntersectionDetails>();
	private _observers = new WeakMap<IntersectionObserver, string>();

	private _onIntersect(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
		if (this._observers.has(observer)) {
			const root = this._observers.get(observer);
			const details = this._roots.get(root);
			if (details) {
				entries.forEach((entry) => {
					details.entries.set(entry.target, entry);
					const ratio = entry.intersectionRatio;
					for (const watch of details.watches) {
						if (this.nodes.get(watch.key) === entry.target) {
							if (watch.type === IntersectionWatchType.WITHIN) {
								if (ratio > 0) {
									this.invalidate();
								}
							}
							else if (watch.type === IntersectionWatchType.ANY) {
								this.invalidate();
							}
						}
					}
				});
			}
		}
	}

	private _observe(observer: IntersectionObserver, node: Element) {
		observer.observe(node);
		if (typeof (<any> observer)._checkForIntersections === 'function') {
			(<any> observer)._checkForIntersections();
		}
	}

	private _getObserver(root: string, rootNode?: Element): IntersectionObserver {
		let details = this._roots.get(root);
		if (!details) {
			details = {
				entries: new WeakMap<Element, IntersectionObserverEntry>(),
				observerThresholds: new Set<number>(),
				thresholds: new Set<number>(),
				watches: []
			};
			this._roots.set(root, details);
		}

		const observer = details.observer;
		if (observer) {
			const union = new Set(details.thresholds);
			for (const threshold of from(details.observerThresholds.values())) {
				union.add(threshold);
			}
			if (union.size !== details.thresholds.size || union.size !== observer.thresholds.length) {
				console.log('thresholds differ and the observer needs to be re-established');
				observer.disconnect();
				delete details.observer;

				const rootObserver = this._getObserver(root, rootNode);
				for (const watch of details.watches) {
					this.requireNode(watch.key, this._observe.bind(this, rootObserver));
				}
			}
		}

		const thresholds = details.thresholds;
		const options: IntersectionObserverInit = {
			rootMargin: '0px',
			threshold: from(thresholds.values())
		};
		if (rootNode) {
			options.root = rootNode;
		}
		const rootObserver = new global.IntersectionObserver(this._onIntersect.bind(this), options);
		details.observer = rootObserver;
		this._observers.set(rootObserver, root);
		return rootObserver;
	}

	public watch(key: string, watchType: IntersectionWatchType, root: string, thresholds?: number | number[]): void;
	public watch(key: string, watchType: IntersectionWatchType, root: string): void;
	public watch(key: string, watchType: IntersectionWatchType, thresholds: number | number[]): void;
	public watch(key: string, watchType: IntersectionWatchType, ...args: any[]): void {
		let root = '';
		let thresholds: number[] = [];
		if (args.length === 2) {
			root = args[0];
			thresholds = args[1];
		}
		else if (args.length === 1) {
			if (typeof args[0] === 'string') {
				root = args[0];
			}
			else {
				thresholds = args[0];
			}
		}
		if (typeof thresholds === 'number') {
			thresholds = [ thresholds ];
		}
		if (thresholds.length === 0) {
			thresholds.push(0.001);
		}

		let details = this._roots.get(root);
		if (!details) {
			details = {
				entries: new WeakMap<Element, IntersectionObserverEntry>(),
				observerThresholds: new Set<number>(),
				thresholds: new Set<number>(),
				watches: []
			};
			this._roots.set(root, details);
		}

		for (const ratio of thresholds) {
			details.thresholds.add(ratio);
		}

		let found: undefined | IntersectionWatchOptions = undefined;
		for (const watch of details.watches) {
			if (watch.key === key) {
				found = watch;
				break;
			}
		}
		if (found) {
			found.type = watchType;
			found.thresholds = thresholds;
		}
		else {
			details.watches.push({
				key,
				thresholds,
				type: watchType
			});
		}

		this._establish(key, root);
	}

	private _establish(key: string, root: string) {
		if (root) {
			this.requireNode(root, (rootNode) => {
				this.requireNode(key, (node) => {
					this._observe(this._getObserver(root, rootNode), node);
				});
			});
		}
		else {
			this.requireNode(key, (node) => {
				this._observe(this._getObserver(root), node);
			});
		}
	}

	public get(key: string, root: string = ''): number {
		let details = this._roots.get(root);
		if (!details) {
			this._establish(key, root);
		}
		else {
			const node = this.nodes.get(key);
			if (node) {
				if (details.observer) {
					const entries = details.observer.takeRecords();
					if (entries.length) {
						this._onIntersect(entries, details.observer);
					}
				}
				if (details.entries.has(node)) {
					return details.entries.get(node).intersectionRatio;
				}
			}
		}

		return 0;
	}
}

export default Intersection;
