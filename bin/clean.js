#!/usr/bin/env node
/**
 * @file Removes build artifacts prior to bundling.
 * Clears `dist/` so builds start from a predictable state.
 */
import * as fs from 'fs-extra'

fs.emptyDirSync('./dist')
