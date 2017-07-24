import global from '@dojo/core/global';
import { includes } from '@dojo/shim/array';
import Map from '@dojo/shim/Map';
import { Subscription } from '@dojo/shim/Observable';
import {
	WidgetMetaOptions,
	WidgetMetaProperties,
	WidgetMetaRequiredNode,
	WidgetMetaSubscriptionSingleCallback,
	WidgetMetaSubscriptionMultiCallback
} from '../interfaces';
import { meta } from '../WidgetBase';

interface Callback<T> {
	callback?: WidgetMetaSubscriptionSingleCallback<T> | WidgetMetaSubscriptionMultiCallback<T>;
}

const log = false;

export class Base<T, O extends WidgetMetaOptions = WidgetMetaOptions> {
	private _subscriptions = new Map<string, Callback<T>[]>();
	private _managed: { [key: string]: Subscription } = {};
	private _invalidate: () => void;
	private _boundInvalidate: () => void;
	private _requiredKeys: string[] = [];
	private _invalidating: number;
	private _keys: string[] = [];
	private _requiredNodes: Map<string, WidgetMetaRequiredNode[]>;
	protected nodes: Map<string, HTMLElement>;
	protected options: O;

	constructor(properties: WidgetMetaProperties, options: O) {
		this._invalidate = properties.invalidate;
		this._boundInvalidate = () => {
			this._invalidate();
		};
		this._requiredNodes = properties.requiredNodes;

		this.nodes = properties.nodes;
		this.options = options;
	}

	protected invalidate(keys?: string[]): void {
		const {
			_subscriptions: subscriptions
		} = this;

		if (keys) {
			let caught = true;
			const values = new Map<string, T>();
			for (const key of keys) {
				if (this.has(key)) {
					const value: T = this.get(key);
					values.set(key, value);
					const callbacks = subscriptions.get(key);
					if (callbacks) {
						for (const callback of callbacks) {
							callback.callback && (<WidgetMetaSubscriptionSingleCallback<T>> callback.callback)(value);
						}
					}
					else {
						caught = false;
					}
				}
			}
			const callbacks = subscriptions.get(meta.ALL_KEYS);
			if (callbacks) {
				caught = true;
				if (keys.length) {
					for (const callback of callbacks) {
						callback.callback && (<WidgetMetaSubscriptionMultiCallback<T>> callback.callback)(values);
					}
				}
			}
			if (caught) {
				return;
			}
		}

		global.cancelAnimationFrame(this._invalidating);
		this._invalidating = global.requestAnimationFrame(this._boundInvalidate);
	}

	protected requireNode(key: string, callback?: WidgetMetaRequiredNode): void {
		if (this._requiredKeys.indexOf(key) < 0) {
			this._requiredKeys.push(key);
		}
		const node = this.nodes.get(key);
		if (node) {
			callback && callback.call(this, node);
		}
		else {
			const callbacks: WidgetMetaRequiredNode[] = this._requiredNodes.get(key) || [];
			callback && callbacks.push(callback);
			this._requiredNodes.set(key, callbacks);
			if (callback === undefined) {
				this.invalidate();
			}
		}
	}

	protected track(key: string): void {}

	protected untrack(key: string): void {}

	public get(key: string): T {
		return <any> undefined;
	}

	public has(key: string): boolean {
		return this.nodes.has(key);
	}

	public onKeysUpdated(keys: string[]): void {
		const {
			_managed: managed,
			_subscriptions: subscriptions
		} = this;
		// use keys from the past render to subscribe to all keys we haven't already
		const subscription = subscriptions.get(meta.ALL_KEYS);
		if (subscription) {
			for (const key of keys) {
				if (!this._managed[key]) {
					this._managed[key] = this.subscribe(key);
				}
			}
		}
		for (const key of this._keys) {
			// Identify keys that have disappeared since the last render
			if (!includes(keys, key)) {
				if (managed[key]) {
					// Unsubscribe from subscriptions we manage
					managed[key].unsubscribe();
					delete managed[key];
				}
				if (!includes(this._requiredKeys, key)) {
					// Telling meta classes to stop tracking is useful
					// if they have to set up an event handler in their
					// get. This will only happen on a render where the
					// key does not appear.
					this.untrack(key);
				}
			}
		}
		this._keys = keys.slice();
	}

	public subscribe(key: string, callback?: WidgetMetaSubscriptionSingleCallback<T>): Subscription {
		const callbacks = this._subscriptions.get(key) || [];
		const callbackDetails = {
			callback
		};
		callbacks.push(callbackDetails);
		this._subscriptions.set(key, callbacks);
		if (callback && this.has(key)) {
			callback(this.get(key));
		}
		if (key !== meta.ALL_KEYS) {
			this.track(key);
		}
		log && console.log('subscribing to', key);
		const subscription = {
			closed: false,
			unsubscribe: () => {
				if (!subscription.closed) {
					subscription.closed = true;
					const callbacks = this._subscriptions.get(key);
					if (callbacks) {
						const index = callbacks.indexOf(callbackDetails);
						if (index > -1) {
							callbacks.splice(index, 1);
							if (callbacks.length === 0) {
								log && console.log('unsubscribing from', key);
								this._subscriptions.delete(key);
								this.untrack(key);
							}
						}
					}
				}
			}
		};
		return subscription;
	}
}

export default Base;
