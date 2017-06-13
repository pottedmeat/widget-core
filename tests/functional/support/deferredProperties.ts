import { v } from '../../../src/d';
import { WidgetProperties } from '../../../src/interfaces';
import MetaBase from '../../../src/meta/Base';
import { ProjectorMixin } from '../../../src/mixins/Projector';
import { WidgetBase } from '../../../src/WidgetBase';

class WidthMeta extends MetaBase {
	get(key: string): number {
		this.requireNode(key);
		const node = this.nodes.get(key);
		return node ? node.getBoundingClientRect().width : 0;
	}
}

interface TestWidgetProperties extends WidgetProperties {
	text?: string;
}

class TestWidget extends WidgetBase<TestWidgetProperties> {
	render() {
		return v('div', {
			key: 'root',
			styles: {
				width: <any> (() => {
					return this.meta(WidthMeta).get('another') + 'px';
				})
			}
		}, [
			v('div', {
				key: 'another',
				innerHTML: this.properties.text || '',
				styles: {
					display: 'inline-block'
				}
			})
		]);
	}
}

let text = 'hello';

const projector = new (ProjectorMixin(TestWidget))();
projector.setProperties({ text });
projector.append(document.body);

document.getElementById('button')!.addEventListener('click', () => {
	text += ' hello';
	projector.setProperties({ text });
});
