import global from '@dojo/core/global';
import WeakMap from '@dojo/shim/WeakMap';
import { Base } from './Base';

import 'intersection-observer';

(<{ THROTTLE_TIMEOUT: number }> global.IntersectionObserver.prototype).THROTTLE_TIMEOUT = 0;

interface IntersectionDetail {
	entries: WeakMap<Element, IntersectionObserverEntry>;
	keys: string[];
	intersections: { [key: string]: number }; // previous intersections
	intersectionObserver?: IntersectionObserver; // attached observer
	root: string;
	rootMargin: string | undefined;
	step: number | undefined;
	thresholds: number[]; // thresholds the observe should be attached with
}

export interface IntersectionGetOptions {
	root?: string;
	rootMargin?: string;
	step?: number;
	threshold?: number;
	thresholds?: number[];
}

export class Intersection extends Base<number, IntersectionGetOptions> {
	private _details: IntersectionDetail[] = [];

	private _getDetails(options: IntersectionGetOptions): IntersectionDetail {
		let {
			root = '',
			rootMargin,
			step,
			threshold,
			thresholds = []
		} = options;
		const {
			_details: details
		} = this;

		if (typeof threshold === 'number' && !step && !thresholds.length) {
			thresholds = [ threshold ];
		}
		let cached: IntersectionDetail | undefined = undefined;
		for (const detail of details) {
			if (
				root === detail.root &&
				rootMargin === detail.rootMargin &&
				step === detail.step &&
				thresholds.length === detail.thresholds.length &&
				thresholds.every(function(i) {
					return thresholds[i] === detail.thresholds[i];
				})
			) {
				cached = detail;
				break;
			}
		}
		if (!cached) {
			if (typeof step === 'number' && !thresholds.length) {
				thresholds = [];
				const steps = Math.floor(1 / step);
				for (let i = 0; i <= steps; i ++) {
					thresholds.push(step * i);
				}
			}
			cached = {
				entries: new WeakMap<Element, IntersectionObserverEntry>(),
				intersections: {},
				keys: [],
				root,
				rootMargin,
				step,
				thresholds
			};
			details.push(cached);
		}
		return cached;
	}

	private _getIntersectionObserver(details: IntersectionDetail, rootNode?: Element): IntersectionObserver {
		if (details.intersectionObserver) {
			return details.intersectionObserver;
		}

		const {
			rootMargin = '0px',
			thresholds
		} = details;

		const intersectionOptions: IntersectionObserverInit = {
			rootMargin,
			threshold: thresholds.length ? thresholds : 0.000001
		};
		if (rootNode) {
			intersectionOptions.root = rootNode;
		}
		const observer = new global.IntersectionObserver(this._onIntersect.bind(this, details), intersectionOptions);
		details.intersectionObserver = observer;
		return observer;
	}

	private _observe(rootNode: HTMLElement | undefined, node: HTMLElement, details: IntersectionDetail): void {
		const intersectionObserver = this._getIntersectionObserver(details, rootNode);
		intersectionObserver.observe(node);
		if (typeof (<any> intersectionObserver)._checkForIntersections === 'function') {
			(<any> intersectionObserver)._checkForIntersections();
		}
	}

	/*
	private _unobserve(rootNode: HTMLElement | undefined, node: HTMLElement, details: IntersectionDetail): void {
		const intersectionObserver = this._getIntersectionObserver(details, rootNode);
		intersectionObserver.unobserve(node);
	}
	*/

	private _onIntersect(details: IntersectionDetail, intersectionObserverEntries: IntersectionObserverEntry[]) {
		const lookup = new WeakMap<Element, string>();
		for (const key of details.keys) {
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
				if (key) {
					details.intersections[key] = intersectionEntry.intersectionRatio;
					keys.push(key);
				}
			}
		}
		this.invalidate(keys);
	}

	protected track(key: string, options: IntersectionGetOptions): void {
		const details = this._getDetails(options);
		if (details.keys.indexOf(key) < 0) {
			details.keys.push(key);
		}
		const keys: string[] = [ key ];
		if (details.root) {
			keys.push(details.root);
		}
		this.requireNode(keys, (node, rootNode) => {
			this._observe(rootNode, node, details);
		});
	}

	public get(key: string, options: IntersectionGetOptions = {}): number {
		if (this.has(key, options)) {
			return this._getDetails(options).intersections[key];
		}
		this.track(key, options);
		return 0;
	}

	public has(key: string, options: IntersectionGetOptions = {}): boolean {
		if (!this.nodes.has(key)) {
			return false;
		}
		const details = this._getDetails(options);
		const intersectionObserver = details.intersectionObserver;
		if (intersectionObserver) {
			const entries = intersectionObserver.takeRecords();
			if (entries.length) {
				this._onIntersect(details, entries);
			}
		}
		return (typeof details.intersections[key] === 'number');
	}
}

export default Intersection;
