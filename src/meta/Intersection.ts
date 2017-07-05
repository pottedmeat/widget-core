import global from '@dojo/core/global';
import Map from '@dojo/shim/Map';
import WeakMap from '@dojo/shim/WeakMap';
import MetaBase from '../meta/Base';

import 'intersection-observer';

/**
 * @type IntersectionOptions
 *
 * Describes the options that can be passed when requesting intersection information.
 *
 * @param root       Optional root node
 * @param invalidate Set to false to prevent invalidation on intersection change
 */
export interface IntersectionOptions {
	/** default true */
	root?: string;
}

interface IntersectionDetails {
	entries: WeakMap<Element, IntersectionObserverEntry>;
}

export class Intersection extends MetaBase {
	private _roots = new Map<string, IntersectionObserver>();
	private _details = new WeakMap<IntersectionObserver, IntersectionDetails>();

	private _onIntersect(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
		const details = this._details.get(observer);
		entries.forEach((entry) => {
			details.entries.set(entry.target, entry);
			this.invalidate();
		});
	}

	public get(key: string, { root = '' }: IntersectionOptions = {}): number {
		let rootObserver = this._roots.get(root);
		if (!rootObserver) {
			const intersectionOptions: IntersectionObserverInit = {
				rootMargin: '0px',
				threshold: 0.0000001
			};
			if (root) {
				this.requireNode(root);
				const rootNode = this.nodes.get(root);
				if (rootNode) {
					intersectionOptions.root = rootNode;
					rootObserver = new global.IntersectionObserver(this._onIntersect.bind(this), intersectionOptions);
				}
			}
			else {
				rootObserver = new global.IntersectionObserver(this._onIntersect.bind(this), intersectionOptions);
			}
			if (rootObserver) {
				this._roots.set(root, rootObserver);
				this._details.set(rootObserver, {
					entries: new WeakMap<Element, IntersectionObserverEntry>()
				});
			}
		}

		if (rootObserver) {
			this.requireNode(key);
			const node = this.nodes.get(key);
			if (node) {
				const details = this._details.get(rootObserver);
				if (details.entries.has(node)) {
					return details.entries.get(node).intersectionRatio;
				}
				rootObserver.observe(node);
			}
		}

		return 0;
	}
}

export default Intersection;
