import {ES, ES_PATTERNS} from './i18n/es.js';

export const LANGUAGE_KEY = 'settingUiLanguage';

const DICTIONARIES = {es: {words: ES, patterns: ES_PATTERNS}};
const ATTRIBUTES = ['data-tip', 'aria-label', 'title', 'placeholder'];
const SKIP = 'script, style, textarea, [data-no-i18n], [data-ignore-name]';

const shownText = new WeakMap();
const shownAttributes = new WeakMap();

let active = 'en';
let observer = null;
let unsubscribe = null;

function lookup(dictionary, core) {
    if (Object.hasOwn(dictionary.words, core)) return dictionary.words[core];
    for (const [regex, render] of dictionary.patterns) {
        const match = core.match(regex);
        if (match) return render(match, part => lookup(dictionary, part) ?? part);
    }
    return undefined;
}

export function translate(text, language = active) {
    const dictionary = DICTIONARIES[language];
    const core = text.replace(/\s+/g, ' ').trim();
    if (!dictionary || !core) return text;
    const hit = lookup(dictionary, core);
    if (hit === undefined) return text;
    return text.match(/^\s*/)[0] + hit + text.match(/\s*$/)[0];
}

export function t(text) {
    return translate(text, active);
}

export function currentLanguage() {
    return active;
}

function resolve(original, language) {
    return language in DICTIONARIES ? translate(original, language) : original;
}

function syncText(node, language) {
    const record = shownText.get(node);
    const original = record?.shown === node.data ? record.original : node.data;
    const next = resolve(original, language);
    if (next !== node.data) node.data = next;
    if (next === original) shownText.delete(node);
    else shownText.set(node, {original, shown: next});
}

function syncAttribute(element, name, language) {
    if (!element.hasAttribute(name)) return;
    const records = shownAttributes.get(element) ?? new Map();
    const current = element.getAttribute(name);
    const record = records.get(name);
    const original = record?.shown === current ? record.original : current;
    const next = resolve(original, language);
    if (next !== current) element.setAttribute(name, next);
    if (next === original) {
        records.delete(name);
    } else {
        records.set(name, {original, shown: next});
        shownAttributes.set(element, records);
    }
}

function visit(node, language) {
    if (node.nodeType === 3) {
        syncText(node, language);
        return;
    }
    if (node.nodeType !== 1 || node.matches(SKIP)) return;
    for (const name of ATTRIBUTES) syncAttribute(node, name, language);
    for (const child of node.childNodes) visit(child, language);
}

function insideSkipped(node) {
    return (node.nodeType === 1 ? node : node.parentElement)?.closest(SKIP) != null;
}

export function translateTree(root, language = active) {
    if (!insideSkipped(root)) visit(root, language);
}

function onMutations(records) {
    if (!(active in DICTIONARIES)) return;
    for (const record of records) {
        const {target} = record;
        if (record.type === 'characterData') {
            if (!insideSkipped(target)) syncText(target, active);
        } else if (record.type === 'attributes') {
            if (!insideSkipped(target)) syncAttribute(target, record.attributeName, active);
        } else {
            for (const node of record.addedNodes) translateTree(node, active);
        }
    }
}

export function setLanguage(language, doc = document) {
    active = language in DICTIONARIES ? language : 'en';
    doc.documentElement.lang = active;
    translateTree(doc.documentElement, active);
}

export function initI18n(sync, doc = document) {
    stopI18n();
    const apply = () => setLanguage(sync.get(LANGUAGE_KEY), doc);
    apply();
    sync.on(LANGUAGE_KEY, apply);
    unsubscribe = () => sync.off(LANGUAGE_KEY, apply);
    observer = new MutationObserver(onMutations);
    observer.observe(doc.documentElement, {
        childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES,
    });
}

export function stopI18n(doc = document) {
    observer?.disconnect();
    observer = null;
    unsubscribe?.();
    unsubscribe = null;
    if (active !== 'en') setLanguage('en', doc);
}
