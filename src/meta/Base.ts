import global from '@dojo/shim/global';
import Map from '@dojo/shim/Map';
import { WidgetMetaProperties, WidgetMetaRequiredNodeCallback } from '../interfaces';

export class Base {
	private _invalidate: () => void;
	private _invalidating: number;
	private _requiredNodes: Map<string, WidgetMetaRequiredNodeCallback[]>;
	protected nodes: Map<string, HTMLElement>;

	constructor(properties: WidgetMetaProperties) {
		this._invalidate = properties.invalidate;
		this._requiredNodes = properties.requiredNodes;

		this.nodes = properties.nodes;
	}

	public has(key: string): boolean {
		return this.nodes.has(key);
	}

	protected invalidate(): void {
		global.cancelAnimationFrame(this._invalidating);
		this._invalidating = global.requestAnimationFrame(this._invalidate);
	}

	protected requireNode(key: string | string[], callback?: WidgetMetaRequiredNodeCallback): void {
		const keys = Array.isArray(key) ? key : [ key ];
		const found: HTMLElement[] = [];
		for (const key of keys) {
			const node = this.nodes.get(key);
			if (node) {
				found.push(node);
			}
			else {
				break;
			}
		}
		if (keys.length === found.length) {
			callback && callback.apply(this, found);
			return;
		}
		let wrapper = callback;
		if (callback && keys.length > 1) {
			let once = false;
			wrapper = () => {
				/* istanbul ignore else: only run once */
				if (!once) {
					const found: HTMLElement[] = [];
					for (const key of keys) {
						const node = this.nodes.get(key);
						if (node) {
							found.push(node);
						}
						else {
							break;
						}
					}
					if (keys.length === found.length) {
						once = true;
						callback && callback.apply(this, found);
					}
				}
			};
		}
		for (const key of keys) {
			const callbacks = this._requiredNodes.get(key) || [];
			wrapper && callbacks.push(wrapper);
			this._requiredNodes.set(key, callbacks);
			if (!callback) {
				this.invalidate();
			}
		}
	}
}

export default Base;
