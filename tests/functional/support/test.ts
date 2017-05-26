import { WidgetBase } from '../../../src/WidgetBase';
import { WidgetProperties } from '../../../src/interfaces';
import { v } from '../../../src/d';
import { ProjectorMixin } from '../../../src/mixins/Projector';
import Dimensions from '../../../src/meta/Dimensions';

interface TestWidgetProperties extends WidgetProperties {
	text?: string;
}

class TestWidget extends WidgetBase<TestWidgetProperties> {
	render() {
		return v('div', {
			key: 'root',
			styles: {
				width: <any> (() => {
					return this.meta(Dimensions).get('another').width + 'px';
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

const projector = new (ProjectorMixin(TestWidget))();
projector.append(document.body);

let text = 'hello';

document.getElementById('button')!.addEventListener('click', () => {
	text = text + ' hello';
	projector.setProperties({ text });
});
