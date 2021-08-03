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
# Minimize JS
#node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/search.js > dist/chrome/popup/js/search.js
#node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/options.js > dist/chrome/popup/js/options.js
#node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/editOptions.js > dist/chrome/popup/js/editOptions.js
#node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/utils.js > dist/chrome/popup/js/utils.js

# Remove mock data
rm -rf dist/chrome/popup/mockData

## FIREFOX ###################

cp -r dist/chrome dist/firefox
cp manifest.firefox.json dist/firefox/manifest.json
cp README.md dist/firefox/README.md
