import global from '@dojo/core/global';
import Map from '@dojo/shim/Map';
import { WidgetMetaProperties, WidgetMetaRequiredNode } from '../interfaces';

export class Base {
	private _invalidate: (force?: boolean) => void;
	private _boundInvalidate: () => void;
	private _forceInvalidate: () => void;
	private _invalidating: number;
	private _requiredNodes: Map<string, WidgetMetaRequiredNode[]>;
	protected nodes: Map<string, HTMLElement>;

	constructor(properties: WidgetMetaProperties) {
		this._invalidate = properties.invalidate;
		this._boundInvalidate = () => {
			this._invalidate();
		};
		this._forceInvalidate = () => {
			this._invalidate(true);
		};
		this._requiredNodes = properties.requiredNodes;

		this.nodes = properties.nodes;
	}

	public has(key: string, ...args: any[]): boolean {
		return this.nodes.has(key);
	}

	protected invalidate(force?: boolean): void {
		global.cancelAnimationFrame(this._invalidating);
		this._invalidating = global.requestAnimationFrame(force ? this._forceInvalidate : this._boundInvalidate);
	}

	protected requireNode(key: string, callback?: WidgetMetaRequiredNode): void {
		const node = this.nodes.get(key);
		if (node) {
			callback && callback.call(this, node);
		}
		else {
			const callbacks: WidgetMetaRequiredNode[] = this._requiredNodes.get(key) || [];
			callback && callbacks.push(callback);
			this._requiredNodes.set(key, callbacks);
			if (callback === undefined) {
				this.invalidate(true);
			}
		}
	}
}

export default Base;
