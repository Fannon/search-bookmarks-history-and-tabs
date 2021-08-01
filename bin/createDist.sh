# This shell script compiles, minifies and copies the necessary files 
# to the dist/ folder for publishing purposes.

rm -rf dist/
mkdir dist/

cp manifest.json dist/manifest.json
cp background.js dist/background.js

mkdir dist/images/
cp images/edit.svg dist/images/edit.svg
cp images/logo-16.png dist/images/logo-16.png
cp images/logo-32.png dist/images/logo-32.png
cp images/logo-48.png dist/images/logo-48.png
cp images/logo-128.png dist/images/logo-128.png

cp -r popup/ dist/popup/
# Minimize JS
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/src/search.js > dist/popup/src/search.js
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/src/options.js > dist/popup/src/options.js
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/src/editOptions.js > dist/popup/src/editOptions.js
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/src/utils.js > dist/popup/src/utils.js

# Remove mock data
rm -rf dist/popup/mockData
