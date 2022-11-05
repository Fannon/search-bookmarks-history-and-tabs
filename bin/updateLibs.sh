rm -rf popup/lib
mkdir popup/lib

cat node_modules/\@leeoniya/ufuzzy/dist/uFuzzy.iife.min.js >> popup/lib/uFuzzy.iife.min.js
cat node_modules/mark.js/dist/mark.es6.min.js >> popup/lib/mark.es6.min.js

# Copy over vendor dependencies that we don't bundle, because they're only loaded on demand
cp node_modules/js-yaml/dist/js-yaml.min.js popup/lib/js-yaml.min.js
cp node_modules/\@yaireo/tagify/dist/tagify.min.js popup/lib/tagify.min.js
