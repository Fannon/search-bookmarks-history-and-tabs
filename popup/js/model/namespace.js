//////////////////////////////////////////
// EXTENSION NAMESPACE                  //
//////////////////////////////////////////

import { browserApi } from '../helper/browserApi.js'

/** Browser extension namespace */
export const extensionNamespace = {
  /** Options */
  opts: {},
  /** Model / data */
  model: {
    /** Currently selected result item */
    currentItem: 0,
    /** Current search results */
    result: [],
  },
  /** Search indexes */
  index: {
    fuzzy: {},
    precise: {},
    taxonomy: {},
  },
  /** Commonly used DOM Elements */
  dom: {},
  /** The browser / extension API */
  browserApi: browserApi,

  /** Whether extension is already initialized -> ready for search */
  initialized: false,
}
