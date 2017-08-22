import global from '@dojo/shim/global';
import Map from '@dojo/shim/Map';
import { WidgetMetaProperties, WidgetMetaRequiredNodeCallback } from '../interfaces';
import { MetaTestCondition } from './interfaces';

export abstract class Base<T = any, O extends object = object> {
	private _invalidate: () => void;
	private _invalidating: number;
	private _requiredNodes: Map<string, WidgetMetaRequiredNodeCallback[]>;
	private _tests: { [key: string]: [ MetaTestCondition<T>, O | undefined, T ] } = {};
	protected nodes: Map<string, HTMLElement>;

	constructor(properties: WidgetMetaProperties) {
		this._invalidate = properties.invalidate;
		this._requiredNodes = properties.requiredNodes;

		this.nodes = properties.nodes;
	}

	protected invalidate(keys?: string[]): void {
		const tests = this._tests;
		let invalidate = true;
		if (keys && keys.length) {
			invalidate = false;
			for (const key of keys) {
				if (key in tests) {
					const [ condition, options, previousValue ] = tests[key];
					const value = this.get(key, options);
					if (condition(previousValue, value, key)) {
						invalidate = true;
					}
					tests[key][2] = value;
				}
			}
		}
		if (invalidate) {
			global.cancelAnimationFrame(this._invalidating);
			this._invalidating = global.requestAnimationFrame(this._invalidate);
		}
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
			let called = false;
			wrapper = () => {
				if (!called) {
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
						called = true;
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

	public abstract get(key: string, options?: O): Readonly<T>;

	public has(key: string): boolean {
		return this.nodes.has(key);
	}

	public test(key: string, condition: MetaTestCondition<T>, options?: O): void {
		this._tests[key] = [ condition, options, this.get(key, options) ];
	}
}

export default Base;
