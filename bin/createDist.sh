# This shell script compiles, minifies and copies the necessary files 
# to the dist/chrome/ folder for publishing purposes.

rm -rf dist/
mkdir -p dist/
mkdir -p dist/chrome/

cp manifest.json dist/chrome/manifest.json

mkdir dist/chrome/images/
cp images/edit.svg dist/chrome/images/edit.svg
cp images/logo-16.png dist/chrome/images/logo-16.png
cp images/logo-32.png dist/chrome/images/logo-32.png
cp images/logo-48.png dist/chrome/images/logo-48.png
cp images/logo-128.png dist/chrome/images/logo-128.png

cp -r popup/ dist/chrome/popup/

# Minify js
node node_modules/terser/bin/terser popup/js/initOptions.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/initOptions.js

node node_modules/terser/bin/terser popup/js/initSearch.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/initSearch.js

node node_modules/terser/bin/terser popup/js/model/namespace.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/model/namespace.js

node node_modules/terser/bin/terser popup/js/model/options.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/model/options.js

node node_modules/terser/bin/terser popup/js/model/searchData.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/model/searchData.js

node node_modules/terser/bin/terser popup/js/helper/browserApi.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/helper/browserApi.js

node node_modules/terser/bin/terser popup/js/helper/utils.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/helper/utils.js

node node_modules/terser/bin/terser popup/js/search/common.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/search/common.js

node node_modules/terser/bin/terser popup/js/search/defaultEntries.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/search/defaultEntries.js

node node_modules/terser/bin/terser popup/js/search/fuseSearch.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/search/fuseSearch.js

node node_modules/terser/bin/terser popup/js/search/searchEngines.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/search/searchEngines.js

node node_modules/terser/bin/terser popup/js/search/simpleSearch.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/search/simpleSearch.js

node node_modules/terser/bin/terser popup/js/search/taxonomySearch.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/search/taxonomySearch.js

node node_modules/terser/bin/terser popup/js/view/editBookmarkView.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/view/editBookmarkView.js

node node_modules/terser/bin/terser popup/js/view/editOptionsView.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/view/editOptionsView.js

node node_modules/terser/bin/terser popup/js/view/editOptionsView.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/view/editOptionsView.js

node node_modules/terser/bin/terser popup/js/view/foldersView.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/view/foldersView.js

node node_modules/terser/bin/terser popup/js/view/searchView.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/view/searchView.js

node node_modules/terser/bin/terser popup/js/view/tagsView.js \
  -c -m --module --ecma 2015 -o dist/chrome/popup/js/view/tagsView.js

# node node_modules/terser/bin/terser \
#   popup/js/initSearch.js \
#   popup/js/model/namespace.js \
#   popup/js/model/options.js \
#   popup/js/model/searchData.js \
#   popup/js/helper/browserApi.js \
#   popup/js/helper/utils.js \
#   popup/js/search/common.js \
#   popup/js/search/defaultEntries.js \
#   popup/js/search/fuseSearch.js \
#   popup/js/search/searchEngines.js \
#   popup/js/search/simpleSearch.js \
#   popup/js/search/taxonomySearch.js \
#   popup/js/view/editBookmarkView.js \
#   popup/js/view/editOptionsView.js \
#   popup/js/view/foldersView.js \
#   popup/js/view/searchView.js \
#   popup/js/view/tagsView.js \
#   -c -m --ecma 2015--toplevel --module --ecma 2015 -o dist/chrome/popup/js/initSearch.js

# Remove mock data
rm -rf dist/chrome/popup/mockData

## FIREFOX ###################

cp -r dist/chrome dist/firefox
cp manifest.firefox.json dist/firefox/manifest.json
cp README.md dist/firefox/README.md

## FIREFOX ###################

cp -r dist/firefox dist/opera
sed -i -e 's/Period/K/g' dist/opera/manifest.json

