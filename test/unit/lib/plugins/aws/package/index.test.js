'use strict'

const AwsProvider = require('../../../../../../lib/plugins/aws/provider')
const AwsPackage = require('../../../../../../lib/plugins/aws/package/index')
const Serverless = require('../../../../../../lib/serverless')
const CLI = require('../../../../../../lib/classes/cli')
const expect = require('chai').expect
const sinon = require('sinon')
const path = require('path')

describe('AwsPackage', () => {
  let awsPackage
  let serverless
  let options

  beforeEach(() => {
    serverless = new Serverless({ commands: [], options: {} })
    options = {
      stage: 'dev',
      region: 'us-east-1',
    }
    serverless.setProvider('aws', new AwsProvider(serverless, options))
    serverless.serviceDir = 'foo'
    serverless.cli = new CLI(serverless)
    awsPackage = new AwsPackage(serverless, options)
  })

  describe('#constructor()', () => {
    it('should set the serverless instance', () => {
      expect(awsPackage.serverless).to.equal(serverless)
    })

    it('should set options', () => {
      expect(awsPackage.options).to.equal(options)
    })

    it('should set the service path if provided', () => {
      expect(awsPackage.servicePath).to.equal('foo')
    })

    it('should default to an empty service path if not provided', () => {
      serverless.serviceDir = false
      awsPackage = new AwsPackage(serverless, options)

      expect(awsPackage.servicePath).to.equal('')
    })

    it('should use the options package path if provided', () => {
      options.package = 'package-options'
      awsPackage = new AwsPackage(serverless, options)

      expect(awsPackage.packagePath).to.equal('package-options')
    })

    it('should use the services package path if provided', () => {
      serverless.service = {
        package: {
          path: 'package-service',
        },
      }
      awsPackage = new AwsPackage(serverless, options)

      expect(awsPackage.packagePath).to.equal('package-service')
    })

    it('should default to the .serverless directory as the package path', () => {
      expect(awsPackage.packagePath).to.equal(path.join('foo', '.serverless'))
    })

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(awsPackage.provider).to.be.instanceof(AwsProvider))

    it('should have commands', () =>
      expect(awsPackage.commands).to.be.not.empty)

    it('should have hooks', () => expect(awsPackage.hooks).to.be.not.empty)
  })

  describe('hooks', () => {
    let spawnStub
    let generateCoreTemplateStub
    let mergeIamTemplatesStub
    let generateArtifactDirectoryNameStub
    let mergeCustomProviderResourcesStub
    let saveCompiledTemplateStub
    let saveServiceStateStub

    beforeEach(() => {
      spawnStub = sinon.stub(serverless.pluginManager, 'spawn')
      generateCoreTemplateStub = sinon
        .stub(awsPackage, 'generateCoreTemplate')
        .resolves()
      mergeIamTemplatesStub = sinon
        .stub(awsPackage, 'mergeIamTemplates')
        .returns()
      generateArtifactDirectoryNameStub = sinon
        .stub(awsPackage, 'generateArtifactDirectoryName')
        .resolves()
      mergeCustomProviderResourcesStub = sinon
        .stub(awsPackage, 'mergeCustomProviderResources')
        .resolves()
      saveCompiledTemplateStub = sinon
        .stub(awsPackage, 'saveCompiledTemplate')
        .resolves()
      saveServiceStateStub = sinon
        .stub(awsPackage, 'saveServiceState')
        .resolves()
    })

    afterEach(() => {
      serverless.pluginManager.spawn.restore()
      awsPackage.generateCoreTemplate.restore()
      awsPackage.mergeIamTemplates.restore()
      awsPackage.generateArtifactDirectoryName.restore()
      awsPackage.mergeCustomProviderResources.restore()
      awsPackage.saveCompiledTemplate.restore()
      awsPackage.saveServiceState.restore()
    })

    it('should run "package:cleanup" hook', async () => {
      const spawnAwsCommonValidateStub = spawnStub
        .withArgs('aws:common:validate')
        .resolves()
      const spawnAwsCommonCleanupTempDirStub = spawnStub
        .withArgs('aws:common:cleanupTempDir')
        .resolves()

      return awsPackage.hooks['package:cleanup']().then(() => {
        expect(spawnAwsCommonValidateStub.calledOnce).to.equal(true)
        expect(
          spawnAwsCommonCleanupTempDirStub.calledAfter(
            spawnAwsCommonValidateStub,
          ),
        ).to.equal(true)
      })
    })

    it('should run "package:initialize" hook', async () =>
      awsPackage.hooks['package:initialize']().then(() => {
        expect(generateCoreTemplateStub.calledOnce).to.equal(true)
      }))

    it('should run "package:setupProviderConfiguration" hook', () => {
      awsPackage.hooks['package:setupProviderConfiguration']()
      expect(mergeIamTemplatesStub.calledOnce).to.equal(true)
    })

    it('should run "before:package:compileFunctions" hook', async () =>
      awsPackage.hooks['before:package:compileFunctions']().then(() => {
        expect(generateArtifactDirectoryNameStub.calledOnce).to.equal(true)
      }))

    it('should run "package:finalize" hook', async () => {
      const spawnAwsPackageFinalzeStub = spawnStub
        .withArgs('aws:package:finalize')
        .resolves()

      return awsPackage.hooks['package:finalize']().then(() => {
        expect(spawnAwsPackageFinalzeStub.calledOnce).to.equal(true)
      })
    })

    it('should run "aws:package:finalize:mergeCustomProviderResources" hook', async () =>
      awsPackage.hooks[
        'aws:package:finalize:mergeCustomProviderResources'
      ]().then(() => {
        expect(mergeCustomProviderResourcesStub.calledOnce).to.equal(true)
      }))

    it('should run "aws:package:finalize:saveServiceState" hook', async () => {
      const spawnAwsCommonMoveArtifactsToPackageStub = spawnStub
        .withArgs('aws:common:moveArtifactsToPackage')
        .resolves()

      return awsPackage.hooks['aws:package:finalize:saveServiceState']().then(
        () => {
          expect(saveCompiledTemplateStub.calledOnce).to.equal(true)
          expect(
            saveServiceStateStub.calledAfter(saveCompiledTemplateStub),
          ).to.equal(true)
          expect(
            spawnAwsCommonMoveArtifactsToPackageStub.calledAfter(
              saveServiceStateStub,
            ),
          ).to.equal(true)
        },
      )
    })
  })
})
