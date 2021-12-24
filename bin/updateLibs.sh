rm -rf popup/lib
mkdir popup/lib

touch popup/lib/vendor.min.js
# cp node_modules/fuse.js/dist/fuse.basic.min.js popup/lib/fuse.min.js
# cp node_modules/\@yaireo/tagify/dist/tagify.css popup/lib/tagify.css
# cp node_modules/flexsearch/dist/flexsearch.light.js popup/lib/flexsearch.min.js
# cp node_modules/mark.js/dist/mark.es6.min.js popup/lib/mark.min.js
cp node_modules/js-yaml/dist/js-yaml.min.js popup/lib/js-yaml.min.js
cp node_modules/\@yaireo/tagify/dist/tagify.min.js popup/lib/tagify.min.js

cat node_modules/fuse.js/dist/fuse.basic.min.js >> popup/lib/vendor.min.js
echo >> popup/lib/vendor.min.js
cat node_modules/flexsearch/dist/flexsearch.light.js >> popup/lib/vendor.min.js
echo >> popup/lib/vendor.min.js
cat node_modules/mark.js/dist/mark.es6.min.js >> popup/lib/vendor.min.js
