// https://unifiedjs.com/learn/guide/create-a-plugin/
// https://github.com/NullVoxPopuli/limber/blob/77d67a0b6bcc9ebe6621906149de970c8a821bde/frontend/app/components/limber/output/compiler/formats/-compile/markdown-to-ember.ts#L121
import flatMap from 'unist-util-flatmap';
import { v5 as uuidv5 } from 'uuid';
import * as inflection from 'inflection';

const NAMESPACE = '926f034a-f480-4112-a363-321244f4e5de';
const DEFAULT_PREFIX = 'ember-repl';

/**
 * from: https://github.com/NullVoxPopuli/ember-repl/blob/main/addon/utils.ts
 * For any given code block, a reasonably stable name can be
 * generated.
 * This can help with cacheing previously compiled components,
 * and generally allowing a consumer to derive "known references" to user-input
 */
function nameFor(code, prefix = DEFAULT_PREFIX): string {
  let id = uuidv5(code, NAMESPACE);

  return `${prefix ? `${prefix}-` : ''}${id}`;
}
/**
 * Returns the text for invoking a component with a given name.
 * It is assumed the component takes no arguments, as would be the
 * case in REPLs / Playgrounds for the "root" component.
 */
function invocationOf(name): string {
  // assert(
  //   `You must pass a name to invocationOf. Received: \`${name}\``,
  //   typeof name === 'string' && name.length > 0
  // );

  if (name.length === 0) {
    throw new Error(`name passed to invocationOf must have non-0 length`);
  }

  return `<${invocationName(name)} />`;
}

function invocationName(name): string {
  // this library is bad. ugh, I want `@ember/string` as a v2 addon.
  return inflection.camelize(name.replaceAll(/-/g, '_'));
}
// end copying over from ember-repl

const ALLOWED_LANGUAGES = ['gjs', 'hbs'];

export default function remarkGjs(options) {
  const { copyComponent, snippets, demo } = options;
  let { classList: snippetClasses } = snippets || {};
  let { classList: demoClasses } = demo || {};

  snippetClasses ??= [];
  demoClasses ??= [];

  return function transformer(tree, file) {
    flatMap(tree, (node) => {
      if (node.type !== 'code') return [node];

      const { lang, value } = node;

      let { meta } = node;
      meta = meta?.trim();

      if (!meta || !lang) return [node];
      if (!ALLOWED_LANGUAGES.includes(lang)) return [node];

      // apparently my browser targets don't support ??= yet
      file.data.liveCode = file.data.liveCode || [];

      const code = value.trim();
      const name = nameFor(code);
      const invocation = invocationOf(name);
      const invokeNode = {
        type: 'html',
        value: `<div class="${demoClasses}">${invocation}</div>`
      };

      const wrapper = {
        // <p> is wrong, but I think I need to make a rehype plugin instead of remark for this
        type: 'paragraph',
        data: {
          hProperties: { className: snippetClasses }
        },
        children: [node]
      };

      if (options.copyComponent) {
        wrapper.children.push({
          type: 'html',
          value: copyComponent
        });
      }

      file.data.liveCode.push({
        lang,
        name,
        code
      });

      if (meta === 'live preview below') {
        return [wrapper, invokeNode];
      }

      if (meta === 'live preview') {
        return [invokeNode, wrapper];
      }

      if (meta === 'live') {
        return [invokeNode];
      }

      return [wrapper];
    });
  };
}
