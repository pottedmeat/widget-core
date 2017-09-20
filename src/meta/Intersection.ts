import global from '@dojo/shim/global';
import WeakMap from '@dojo/shim/WeakMap';
import { Base } from './Base';

interface IntersectionDetail {
	entries: WeakMap<Element, IntersectionObserverEntry>;
	intersectionObserver?: IntersectionObserver; // attached observer
	/**
	 * Passed options to allow search by reference
	 */
	options: IntersectionGetOptions;
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
	thresholds: number[]; // thresholds the observer should be attached with
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

export class Intersection extends Base {
	private _details: IntersectionDetail[] = [];

	private _getDetails(options: IntersectionGetOptions): IntersectionDetail {
		const {
			root,
			rootMargin,
			thresholds = []
		} = options;
		const {
			_details: details
		} = this;

		// Look to see if a detail record has already been created for these options
		let cached: IntersectionDetail | undefined = undefined;
		for (const detail of details) {
			if (
				options === detail.options ||
				(
					root === detail.root &&
					rootMargin === detail.rootMargin &&
					thresholds.length === detail.thresholds.length &&
					thresholds.every(function(threshold, i) {
						return threshold === detail.thresholds[i];
					})
				)
			) {
				cached = detail;
				break;
			}
		}
		if (!cached) {
			cached = {
				entries: new WeakMap<Element, IntersectionObserverEntry>(),
				options,
				root,
				rootMargin,
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
			rootMargin,
			thresholds
		} = details;

		const intersectionOptions: IntersectionObserverInit = {
			rootMargin
		};
		if (thresholds.length) {
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
				rootNode = this.nodes.get(root) || rootNode;
				node = this.nodes.get(key) || node;
				if (rootNode && node) {
					this._getIntersectionObserver(details, rootNode).observe(node);
				}
			};
			this.requireNode(root, all);
			this.requireNode(key, all);
		}
		else {
			this.requireNode(key, (node) => {
				this._getIntersectionObserver(details).observe(node);
			});
		}

		const node = this.nodes.get(key);
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
		const node = this.nodes.get(key);
		/* istanbul ignore else: only check for true if node exists */
		if (node) {
			const details = this._getDetails(options);
			return details && details.entries.has(node);
		}
		return false;
	}
}

export default Intersection;
