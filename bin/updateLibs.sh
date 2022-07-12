rm -rf popup/lib
mkdir popup/lib

# Create minified vendor min.js where we bundle the search popup dependencies
touch popup/lib/vendor.min.js
# cat node_modules/fuse.js/dist/fuse.basic.min.js >> popup/lib/vendor.min.js
cat node_modules/fuzzysort/fuzzysort.min.js >> popup/lib/vendor.min.js
echo >> popup/lib/vendor.min.js
cat node_modules/mark.js/dist/mark.es6.min.js >> popup/lib/vendor.min.js

# Copy over vendor dependencies that we don't bundle, because they're only loaded on demand
cp node_modules/js-yaml/dist/js-yaml.min.js popup/lib/js-yaml.min.js
cp node_modules/\@yaireo/tagify/dist/tagify.min.js popup/lib/tagify.min.js
