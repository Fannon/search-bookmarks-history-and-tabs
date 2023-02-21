# This shell script compiles, minifies and copies the necessary files 
# to the dist/chrome/ folder for publishing purposes.

rm -rf dist/
mkdir -p dist/
mkdir -p dist/chrome/

cp manifest.json dist/chrome/manifest.json

mkdir dist/chrome/images/
cp images/edit.svg dist/chrome/images/edit.svg
cp images/x.svg dist/chrome/images/x.svg
cp images/logo-16.png dist/chrome/images/logo-16.png
cp images/logo-32.png dist/chrome/images/logo-32.png
cp images/logo-48.png dist/chrome/images/logo-48.png
cp images/logo-128.png dist/chrome/images/logo-128.png

cp -r popup/ dist/chrome/popup/

# Remove mock data
rm -rf dist/chrome/popup/mockData

## FIREFOX ###################

cp -r dist/chrome dist/firefox
cp manifest.firefox.json dist/firefox/manifest.json
cp README.md dist/firefox/README.md

## FIREFOX ###################

cp -r dist/firefox dist/opera
sed -i -e 's/Period/K/g' dist/opera/manifest.json

