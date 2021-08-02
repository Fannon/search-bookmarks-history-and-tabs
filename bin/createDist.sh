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
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/search.js > dist/popup/js/search.js
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/options.js > dist/popup/js/options.js
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/editOptions.js > dist/popup/js/editOptions.js
node node_modules/uglify-js/bin/uglifyjs -cm -- popup/js/utils.js > dist/popup/js/utils.js

# Remove mock data
rm -rf dist/popup/mockData
