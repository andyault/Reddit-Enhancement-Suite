/* @flow */

import { Module } from '../core/module';
import { watchForThings, string } from '../utils';
import { i18n, addURLToHistory } from '../environment';

export const module: Module<*> = new Module('markVisited');

module.moduleName = 'markVisitedName';
module.category = 'browsingCategory';
module.description = 'markVisitedDesc';
module.options = {};
module.permissions = { requiredPermissions: ['history'] };
module.exclude = ['comments'];

module.beforeLoad = () => {
    watchForThings(['post'], thing => {
        const label = i18n('markVisitedLabel')
        const ele = string.html`<li><a href="javascript:void(0)" class="noCtrlF" data-text="${label}"></a></li>`;

        //
        const markThisAsVisited = () => markAsVisited(thing);

		// Prevent empty tab opening on middle click
		(ele.firstElementChild: any).addEventListener('auxclick', e => { e.preventDefault(); });

		(ele.firstElementChild: any).addEventListener('mouseup', (e: MouseEvent) => {
			if (e.button !== 0 && e.button !== 1) return; // Only left and middle click registers
            
            markThisAsVisited();
		});

		thing.getButtons().append(ele);
    });
};

async function markAsVisited(thing) {
    addURLToHistory(thing.getTitleUrl());
};
