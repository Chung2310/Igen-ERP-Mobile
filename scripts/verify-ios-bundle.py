"""Inspect actual built resources; a source manifest alone is insufficient."""
import argparse
import json
from pathlib import Path
import plistlib
import re


def verify(app, simulator=False):
    with (app / 'Info.plist').open('rb') as source:
        info = plistlib.load(source)
    if int(str(info.get('DTXcode', '0'))) < 2600:
        raise ValueError('Xcode 26+ is required for this release.')
    expected_sdk = 'iphonesimulator' if simulator else 'iphoneos'
    if not re.match(expected_sdk + r'(2[6-9]|[3-9]\d)\.', info.get('DTSDKName', '')):
        raise ValueError('Expected iOS 26+ SDK for the selected platform.')
    if float('.'.join(info.get('MinimumOSVersion', '0').split('.')[:2])) < 13:
        raise ValueError('MinimumOSVersion must be iOS 13 or later.')
    ats = info.get('NSAppTransportSecurity', {})
    if ats.get('NSAllowsArbitraryLoads') is not False or ats.get('NSAllowsArbitraryLoadsInWebContent') or ats.get('NSExceptionDomains'):
        raise ValueError('Built app permits insecure networking.')
    for key in ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSFaceIDUsageDescription', 'NSLocationWhenInUseUsageDescription']:
        if 'ERP Mobile' not in info.get(key, ''):
            raise ValueError('Missing built purpose string: ' + key)
    if info.get('UIBackgroundModes'):
        raise ValueError('Unexpected background modes in built app.')
    for key in ['NSLocationAlwaysUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'NSMotionUsageDescription', 'NSUserTrackingUsageDescription']:
        if info.get(key):
            raise ValueError('Unexpected built permission: ' + key)
    manifests = list(app.rglob('PrivacyInfo.xcprivacy'))
    if not manifests or not (app / 'PrivacyInfo.xcprivacy').is_file():
        raise ValueError('Built app is missing its privacy manifest.')
    categories = set()
    for file in manifests:
        with file.open('rb') as source:
            manifest = plistlib.load(source)
        if manifest.get('NSPrivacyTracking') or manifest.get('NSPrivacyTrackingDomains'):
            raise ValueError('Unexpected tracking in a bundled manifest.')
        for row in manifest.get('NSPrivacyAccessedAPITypes', []):
            reasons = row.get('NSPrivacyAccessedAPITypeReasons', [])
            if not reasons or not all(re.fullmatch(r'[A-Z0-9]{4}\.\d+', reason) for reason in reasons):
                raise ValueError('Missing or malformed required-reason API declaration.')
            categories.add(row['NSPrivacyAccessedAPIType'])
    # Installed React Native and expo-file-system explicitly declare these categories.
    required = {'NSPrivacyAccessedAPICategory' + name for name in ['UserDefaults', 'FileTimestamp', 'DiskSpace']}
    if not required <= categories:
        raise ValueError('Dependency required-reason declarations were lost from the bundle.')
    with (app / 'PrivacyInfo.xcprivacy').open('rb') as source:
        app_manifest = plistlib.load(source)
    config = json.loads((Path(__file__).resolve().parent.parent / 'app.json').read_text(encoding='utf-8'))
    expected = config['expo']['ios']['privacyManifests']['NSPrivacyCollectedDataTypes']
    actual = app_manifest.get('NSPrivacyCollectedDataTypes', [])
    if not all(row in actual for row in expected):
        raise ValueError('App data collection declarations were lost during native generation.')
    return {'privacyManifests': len(manifests), 'requiredReasonCategories': sorted(categories), 'sdk': info['DTSDKName']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('app', type=Path)
    parser.add_argument('--simulator', action='store_true')
    args = parser.parse_args()
    print(json.dumps(verify(args.app, args.simulator), indent=2))
