import { isMobile } from '../browser.js'
import { store } from '../store.js'
import {
  RANKED_ROOT,
} from '../constants.js'

// util
import { asyncFocus } from './asyncFocus.js'
import { unrank } from './unrank.js'
import { perma } from './perma.js'
import { isContextViewActive } from './isContextViewActive.js'
import { head } from './head.js'
import { headKey } from './headKey.js'
import { contextOf } from './contextOf.js'
import { splitChain } from './splitChain.js'
import { lastItemsFromContextChain } from './lastItemsFromContextChain.js'
import { itemsEditingFromChain } from './itemsEditingFromChain.js'
import { getContextsSortedAndRanked } from './getContextsSortedAndRanked.js'
import { rootedContextOf } from './rootedContextOf.js'
import { unroot } from './unroot.js'
import { getChildrenWithRank } from './getChildrenWithRank.js'
import { prevSibling } from './prevSibling.js'
import { restoreSelection } from './restoreSelection.js'
import { cursorBack } from './cursorBack.js'

export const deleteItem = () => {

  const state = store.getState()
  const path = state.cursor

  // same as in newItem
  const contextChain = splitChain(path, state.contextViews)
  const showContexts = isContextViewActive(unrank(contextOf(path)), { state })
  const itemsRanked = contextChain.length > 1
    ? lastItemsFromContextChain(contextChain)
    : path
  const contextRanked = showContexts && contextChain.length > 1 ? contextChain[contextChain.length - 2]
    : !showContexts && itemsRanked.length > 1 ? contextOf(itemsRanked) :
    RANKED_ROOT
  const context = unrank(contextRanked)

  const { key, rank } = head(itemsRanked)
  const items = unrank(itemsRanked)

  const prevContext = () => {
    const itemsContextView = itemsEditingFromChain(itemsRanked, state.contextViews)
    const contexts = showContexts && getContextsSortedAndRanked(headKey(itemsContextView))
    const removedContextIndex = contexts.findIndex(context => head(context.context) === key)
    const prevContext = contexts[removedContextIndex - 1]
    return prevContext && {
      key: head(prevContext.context),
      rank: prevContext.rank
    }
  }

  // prev must be calculated before dispatching existingItemDelete
  const prev = showContexts
    ? prevContext()
    : prevSibling(key, contextRanked, rank)

  const next = perma(() =>
    showContexts
      ? unroot(getContextsSortedAndRanked(headKey(contextOf(path))))[0]
      : getChildrenWithRank(contextRanked)[0]
  )

  store.dispatch({
    type: 'existingItemDelete',
    rank,
    showContexts,
    itemsRanked: showContexts
      ? lastItemsFromContextChain(contextChain)
      : unroot(itemsRanked)
  })

  // setCursor or restore selection if editing

  // encapsulate special cases for mobile and last thought
  const restore = (itemsRanked, options) => {
    if (!itemsRanked) {
      cursorBack()
    }
    else if (!isMobile || state.editing) {
      asyncFocus.enable()
      restoreSelection(itemsRanked, options)
    }
    else {
      store.dispatch({ type: 'setCursor', itemsRanked })
    }
  }

  restore(...(
    // Case I: restore selection to prev item
    prev ? [contextOf(path).concat(prev), { offset: prev.key.length }] :
    // Case II: restore selection to next item
    next() ? [showContexts
      ? contextOf(path).concat({ key: head(next().context), rank: next().rank })
      : contextOf(path).concat(next()), { offset: 0 }] :
    // Case III: delete last thought in context; restore selection to context
    items.length > 1 ? [rootedContextOf(path), { offset: head(context).length }]
    // Case IV: delete very last thought; remove cursor
    : [null]
  ))
}
