#!/usr/bin/env bash
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

# Zip dist files for upload to browser stores

if hash 7z 2>/dev/null; then
  cd ./dist/chrome/
  7z a ../chrome.zip ./* -r
else
  echo "7z could not be found"
fi

