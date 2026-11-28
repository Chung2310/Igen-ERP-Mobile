import copy
import importlib.util
import json
from pathlib import Path
import plistlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('bundle', Path(__file__).with_name('verify-ios-bundle.py'))
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = Path(self.temp.name) / 'ERP.app'
        self.app.mkdir()
        self.info = {'DTXcode': '2640', 'DTSDKName': 'iphoneos26.4', 'MinimumOSVersion': '16.0', 'NSAppTransportSecurity': {'NSAllowsArbitraryLoads': False}}
        for key in ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSFaceIDUsageDescription', 'NSLocationWhenInUseUsageDescription']:
            self.info[key] = 'Cho phép ERP Mobile dùng tính năng bạn chọn.'
        config = json.loads((Path(__file__).resolve().parent.parent / 'app.json').read_text(encoding='utf-8'))
        self.manifest = copy.deepcopy(config['expo']['ios']['privacyManifests'])
        self.manifest['NSPrivacyAccessedAPITypes'] = [{'NSPrivacyAccessedAPIType': 'NSPrivacyAccessedAPICategory' + name, 'NSPrivacyAccessedAPITypeReasons': [reason]} for name, reason in [('UserDefaults', 'CA92.1'), ('FileTimestamp', 'C617.1'), ('DiskSpace', 'E174.1')]]

    def write(self):
        (self.app / 'Info.plist').write_bytes(plistlib.dumps(self.info))
        (self.app / 'PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps(self.manifest))

    def test_actual_bundle_manifest_and_sdk(self):
        self.write()
        self.assertEqual(bundle.verify(self.app)['privacyManifests'], 1)
        self.info['DTSDKName'] = 'iphonesimulator26.4'
        self.write()
        bundle.verify(self.app, simulator=True)
        with self.assertRaises(ValueError): bundle.verify(self.app)

    def test_missing_microphone_or_old_sdk_is_rejected(self):
        for key, value in [('NSMicrophoneUsageDescription', ''), ('DTSDKName', 'iphoneos18.0'), ('DTXcode', '1600'), ('UIBackgroundModes', ['audio']), ('MinimumOSVersion', '12.0')]:
            original = copy.deepcopy(self.info)
            self.info[key] = value
            self.write()
            with self.assertRaises(ValueError): bundle.verify(self.app)
            self.info = original

    def test_lost_collection_or_sdk_reason_and_tracking_are_rejected(self):
        for key, value in [('NSPrivacyCollectedDataTypes', []), ('NSPrivacyAccessedAPITypes', []), ('NSPrivacyTracking', True)]:
            original = copy.deepcopy(self.manifest)
            self.manifest[key] = value
            self.write()
            with self.assertRaises(ValueError): bundle.verify(self.app)
            self.manifest = original

    def test_malformed_dependency_manifest_is_not_ignored(self):
        self.write()
        sdk = self.app / 'SDK.bundle'
        sdk.mkdir()
        (sdk / 'PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps({'NSPrivacyAccessedAPITypes': [{'NSPrivacyAccessedAPIType': 'NSPrivacyAccessedAPICategoryDiskSpace', 'NSPrivacyAccessedAPITypeReasons': []}]}))
        with self.assertRaises(ValueError): bundle.verify(self.app)


if __name__ == '__main__':
    unittest.main()
