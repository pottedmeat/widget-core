import global from '@dojo/core/global';
import { from } from '@dojo/shim/array';
import Set from '@dojo/shim/Set';
import WeakMap from '@dojo/shim/WeakMap';
import { WidgetMetaOptions } from '../interfaces';
import SubscribableBase from '../meta/SubscribableBase';

import 'intersection-observer';

interface IntersectionDetail {
	entries: WeakMap<Element, IntersectionObserverEntry>;
	intersections: { [key: string]: number }; // previous intersections
	intersectionObserver?: IntersectionObserver; // attached observer
	keys: Set<string>;
	root: string;
	rootMargin?: string;
	thresholds: number[]; // thresholds the observe should be attached with
}

export interface IntersectionMetaOptions extends WidgetMetaOptions {
	root?: string;
	rootMargin?: string;
	step?: number;
	threshold?: number;
	thresholds?: number[];
}

export class Intersection extends SubscribableBase<number, IntersectionMetaOptions> {
	private _details: IntersectionDetail;

	private _getDetails(): IntersectionDetail {
		let details = this._details;
		if (!details) {
			let {
				root = '',
				rootMargin,
				step,
				threshold,
				thresholds = []
			} = this.options;

			if (typeof step === 'number') {
				thresholds = [];
				const steps = Math.floor(1 / step);
				for (let i = 0; i <= steps; i ++) {
					thresholds.push(step * i);
				}
			}
			if (typeof threshold === 'number') {
				thresholds = [ threshold ];
			}

			details = this._details = {
				entries: new WeakMap<Element, IntersectionObserverEntry>(),
				intersections: {},
				keys: new Set<string>(),
				root,
				rootMargin,
				thresholds
			};
		}
		return details;
	}

	private _getIntersectionObserver(rootNode?: Element): IntersectionObserver {
		const details = this._getDetails();
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
		const observer = new global.IntersectionObserver(this._onIntersect.bind(this), options);
		details.intersectionObserver = observer;
		return observer;
	}

	private _withIntersectionObserver(key: string, callback: (intersectionObserver: IntersectionObserver, node: Element) => void) {
		const {
			root
		} = this._getDetails();

		const withIntersectionObserver = (intersectionObserver: IntersectionObserver) => {
			const node = this.nodes.get(key);
			if (node) {
				callback(intersectionObserver, node);
			}
			else {
				this.requireNode(key, (node) => {
					callback(intersectionObserver, node);
				});
			}
		};

		if (root) {
			const withRootNode = (rootNode: Element) => {
				const intersectionObserver = this._getIntersectionObserver(rootNode);
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
			const intersectionObserver = this._getIntersectionObserver();
			withIntersectionObserver && withIntersectionObserver(intersectionObserver);
		}
	}

	private _onIntersect(intersectionObserverEntries: IntersectionObserverEntry[]) {
		const details = this._getDetails();
		const lookup = new WeakMap<Element, string>();
		for (const key of from(details.keys.values())) {
			const node = this.nodes.get(key);
			if (node) {
				lookup.set(node, key);
			}
		}
		const keys: string[] = [];
		for (const intersectionEntry of intersectionObserverEntries) {
			details.entries.set(intersectionEntry.target, intersectionEntry);
			if (lookup.has(intersectionEntry.target)) {
				const key = lookup.get(intersectionEntry.target);
				details.intersections[key] = intersectionEntry.intersectionRatio;
				keys.push(key);
			}
		}
		this.invalidate(keys);
	}

	protected track(key: string): void {
		const details = this._getDetails();
		if (details.root === key) {
			return;
		}
		details.keys.add(key);
		this._withIntersectionObserver(key, (intersectionObserver, node) => {
			intersectionObserver.observe(node);
			if (typeof (<any> intersectionObserver)._checkForIntersections === 'function') {
				(<any> intersectionObserver)._checkForIntersections();
			}
		});
	}

	protected untrack(key: string): void {
		this._withIntersectionObserver(key, (intersectionObserver, node) => {
			intersectionObserver.unobserve(node);
		});
	}

	public get(key: string): number {
		this.track(key);
		if (this.has(key)) {
			return this._getDetails().intersections[key];
		}
		return 0;
	}

	public has(key: string): boolean {
		const details = this._getDetails();
		const intersectionObserver = details.intersectionObserver;
		if (intersectionObserver) {
			const entries = intersectionObserver.takeRecords();
			if (entries.length) {
				this._onIntersect(entries);
			}
		}
		return (typeof details.intersections[key] === 'number');
	}
}

export default Intersection;
