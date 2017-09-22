import global from '@dojo/shim/global';
import WeakMap from '@dojo/shim/WeakMap';
import { Base } from './Base';

interface IntersectionDetail {
	entries: WeakMap<Element, IntersectionObserverEntry>;
	intersectionObserver?: IntersectionObserver; // attached observer
	/**
	 * Key the observer was created with – stored to allow search by reference
	 */
	root?: string;
	/**
	 * Root margin the observer was created with – stored to allow search by reference
	 */
	rootMargin?: string;
	/**
	 * Thresholds the observer was created with – stored to allow search by reference
	 */
	thresholds?: number[]; // thresholds the observer should be attached with
}

export interface IntersectionGetOptions {
	/**
	 * Ancestor to use as the boundaries for the target element being observed.
	 * The top-level document viewport is used otherwise.
	 */
	root?: string;
	/**
	 * An offset rectangle (in CSS margin syntax) applied to the root's bounding box
	 * to grow (or shrink if negative) the boundaries used to detect intersections.
	 */
	rootMargin?: string;
	/**
	 * An array of numbers between 0.0 and 1.0 specifying the intersection ratios
	 * which should be used to raise an intersection event. If no values are passed,
	 * events are only raised when moving from visible to not visible and from
	 * not visible to visible.
	 *
	 */
	thresholds?: number[];
}

export interface IntersectionResult {
	/**
	 * How much of the target element is visible within its root rectangle
	 */
	intersectionRatio: number;
	/**
	 * Whether the target element is visible
	 */
	isIntersecting: boolean;
}

const defaultIntersection: IntersectionResult = Object.freeze({
	intersectionRatio: 0,
	isIntersecting: false
});

function stringify(options: IntersectionGetOptions): string {
	const {
		root = '',
		rootMargin = '',
		thresholds = []
	} = options;
	return JSON.stringify([root, rootMargin, thresholds]);
}

export class Intersection extends Base {
	private _details: { [cacheKey: string]: IntersectionDetail } = {};

	private _getDetails(options: IntersectionGetOptions): IntersectionDetail {
		// Look to see if a detail record has already been created for these options
		const cacheKey = stringify(options);
		let cached = this._details[cacheKey];
		if (!cached) {
			const entries = new WeakMap<Element, IntersectionObserverEntry>();
			cached = { ...options, entries };
			this._details[cacheKey] = cached;
		}
		return cached;
	}

	private _getIntersectionObserver(details: IntersectionDetail, rootNode?: Element): IntersectionObserver {
		if (details.intersectionObserver) {
			return details.intersectionObserver;
		}

		const {
			rootMargin,
			thresholds
		} = details;

		const intersectionOptions: IntersectionObserverInit = {
			rootMargin
		};
		if (thresholds && thresholds.length) {
			intersectionOptions.threshold = thresholds;
		}
		if (rootNode) {
			intersectionOptions.root = rootNode;
		}
		const observer = new global.IntersectionObserver(this._onIntersect.bind(this, details), intersectionOptions);
		details.intersectionObserver = observer;
		this.own({
			destroy() {
				observer.disconnect();
			}
		});
		return observer;
	}

	private _onIntersect(details: IntersectionDetail, intersectionObserverEntries: IntersectionObserverEntry[]) {
		for (const intersectionEntry of intersectionObserverEntries) {
			details.entries.set(intersectionEntry.target, intersectionEntry);
		}

		this.invalidate();
	}

	public get(key: string, options: IntersectionGetOptions = {}): IntersectionResult {
		const details = this._getDetails(options);
		const root = details.root;
		if (root) {
			let rootNode: HTMLElement;
			let node: HTMLElement;
			const all = () => {
				rootNode = this.nodeHandler.get(root) || rootNode;
				node = this.nodeHandler.get(key) || node;
				if (rootNode && node) {
					this._getIntersectionObserver(details, rootNode).observe(node);
				}
			};
			const rootHandle = this.nodeHandler.on(String(root), function () {
				all();
				rootHandle.destroy();
			});
			const handle = this.nodeHandler.on(String(key), function () {
				all();
				handle.destroy();
			});
		}
		else {
			const handle = this.nodeHandler.on(String(key), () => {
				const node = this.nodeHandler.get(key);
				node && this._getIntersectionObserver(details).observe(node);
				handle.destroy();
			});
		}

		const node = this.nodeHandler.get(key);
		if (details && node) {
			const entry = details.entries.get(node);
			/* istanbul ignore else: only process entry if it exists */
			if (entry) {
				const {
					intersectionRatio,
					isIntersecting
				} = <(IntersectionObserverEntry & { isIntersecting: boolean })> entry;
				return {
					intersectionRatio,
					isIntersecting
				};
			}
		}

		return defaultIntersection;
	}

	public has(key: string, options: IntersectionGetOptions = {}): boolean {
		const node = this.nodeHandler.get(key);
		/* istanbul ignore else: only check for true if node exists */
		if (node) {
			const details = this._getDetails(options);
			return details && details.entries.has(node);
		}
		return false;
	}
}

export default Intersection;
