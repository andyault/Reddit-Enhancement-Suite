/* @flow */

import { Module } from '../core/module';
import { watchForThings, string, downcast } from '../utils';
import { i18n, addURLToHistory } from '../environment';

//stolen from showImages.js
import _ from 'lodash';
import { flow, keyBy, map } from 'lodash/fp';
import { Host } from '../core/host';
import __hosts from 'sibling-loader?import=default!./hosts/default';

const siteModules: { [string]: Host<any, any> } = flow(
	() => Object.values(__hosts),
	map(host => downcast(host, Host)), // ensure that all hosts are instances of `Host`
	keyBy(host => host.moduleID),
)();

export const genericHosts: Host<any, any>[] = [siteModules.default, siteModules.defaultVideo, siteModules.defaultAudio];

//
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

//stolen
function siteModuleOptionKey(siteModule) {
    const id = siteModule.moduleID;
    return `display_${id}`;
}

function isSiteModuleEnabled(siteModule) {
    const key = siteModuleOptionKey(siteModule);
    return !module.options[key] || module.options[key].value;
}

const sitesMap = _.once(() =>
    Object.values(siteModules)
        .filter(isSiteModuleEnabled)
        .reduce((map, siteModule) => {
            for (const domain of siteModule.domains) {
                map.set(domain, (map.get(domain) || []).concat(siteModule));
            }
            return map;
        }, new Map()),
);

// A missing subdomain matches all subdomains, for example:
// A module with `domains: ['example.com']` will match `www.example.com` and `example.com`
// A module with `domains: ['www.example.com']` will match only `www.example.com`
function* modulesForHostname(hostname) {
    do {
        for (const m of sitesMap().get(hostname) || []) yield m;
    } while ((hostname = hostname.replace(/^.+?(\.|$)/, '')));

    for (const m of genericHosts) yield m;
}

//
function getMediaUrls(options, postUrl) {
    switch(options.type) {
        case 'GALLERY': return [...options.src.map(srcMedia => getMediaUrls(srcMedia)), postUrl];
        case 'IMAGE': return [options.src, options.href, postUrl];
        case 'TEXT': return [options.src, postUrl];
        case 'IFRAME': return [options.embed, postUrl];
        case 'VIDEO': return [...options.sources.map(source => source.source), options.source, options.href, postUrl];
        case 'AUDIO': return [...options.sources.map(source => source.file), postUrl];
        // case 'GENERIC_EXPANDO': return [postUrl];
        default: return [postUrl];
    }
};

async function markAsVisited(thing) {
    let postUrl = thing.getPostUrl();

    if (!thing.isLinkPost())
        postUrl = window.location.origin + postUrl;

    console.log('adding ' + postUrl + ' to history');

    try {
        const postUrlObj = new URL(postUrl);

        for (const siteModule of modulesForHostname(postUrlObj.hostname)) {
            const detectResult = siteModule.detect(postUrlObj, thing);
            
            if (detectResult) {
                const mediaOptions = await siteModule.handleLink(postUrl, detectResult);
                
                console.log(mediaOptions);
                
                //extract media urls
                const srcUrls = getMediaUrls(mediaOptions, postUrl);

                console.log('source urls:', srcUrls);
                
                // addURLToHistory(postUrl);

                return;
            }
        }

        console.log('no modules found');
        console.log(postUrl);
    } catch (e) { console.error(e); }
};
