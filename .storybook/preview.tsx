import '../src/globals.css';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
	parameters: {
		options: {
			storySort: {
				order: ['App', '*'],
			},
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
};

export default preview;
