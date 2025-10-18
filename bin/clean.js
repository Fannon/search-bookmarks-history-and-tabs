#!/usr/bin/env node
/**
 * @fileoverview Removes build artifacts prior to bundling.
 *
 * `npm run clean` invokes this helper to clear the dist/ directory so subsequent
 * builds start from a predictable state.
 */
import * as fs from 'fs-extra'

fs.emptyDirSync('./dist')
