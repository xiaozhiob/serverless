'use strict'

const expect = require('chai').expect
const sinon = require('sinon')
const AwsProvider = require('../../../../../../../../../lib/plugins/aws/provider')
const AwsCompileApigEvents = require('../../../../../../../../../lib/plugins/aws/package/compile/events/api-gateway/index')
const Serverless = require('../../../../../../../../../lib/serverless')
const validate = require('../../../../../../../../../lib/plugins/aws/lib/validate')
const getServiceState = require('../../../../../../../../../lib/plugins/aws/lib/get-service-state')
const updateStage = require('../../../../../../../../../lib/plugins/aws/package/compile/events/api-gateway/lib/hack/update-stage')
const disassociateUsagePlan = require('../../../../../../../../../lib/plugins/aws/package/compile/events/api-gateway/lib/hack/disassociate-usage-plan')

describe('AwsCompileApigEvents', () => {
  let awsCompileApigEvents

  beforeEach(() => {
    const serverless = new Serverless({ commands: [], options: {} })
    serverless.service.environment = {
      vars: {},
      stages: {
        dev: {
          vars: {},
          regions: {
            'us-east-1': {
              vars: {},
            },
          },
        },
      },
    }
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    }
    serverless.setProvider('aws', new AwsProvider(serverless, options))
    awsCompileApigEvents = new AwsCompileApigEvents(serverless, options)
  })

  describe('#constructor()', () => {
    let compileRestApiStub
    let compileResourcesStub
    let compileMethodsStub
    let compileRequestValidatorsStub
    let compileDeploymentStub
    let compileUsagePlanStub
    let compilePermissionsStub
    let compileStageStub
    let updateStageStub
    let disassociateUsagePlanStub

    beforeEach(() => {
      compileRestApiStub = sinon
        .stub(awsCompileApigEvents, 'compileRestApi')
        .resolves()
      compileResourcesStub = sinon
        .stub(awsCompileApigEvents, 'compileResources')
        .resolves()
      compileMethodsStub = sinon
        .stub(awsCompileApigEvents, 'compileMethods')
        .resolves()
      compileRequestValidatorsStub = sinon
        .stub(awsCompileApigEvents, 'compileRequestValidators')
        .resolves()
      compileDeploymentStub = sinon
        .stub(awsCompileApigEvents, 'compileDeployment')
        .resolves()
      compileUsagePlanStub = sinon
        .stub(awsCompileApigEvents, 'compileUsagePlan')
        .resolves()
      compilePermissionsStub = sinon
        .stub(awsCompileApigEvents, 'compilePermissions')
        .resolves()
      compileStageStub = sinon
        .stub(awsCompileApigEvents, 'compileStage')
        .resolves()
      updateStageStub = sinon.stub(updateStage, 'updateStage').resolves()
      disassociateUsagePlanStub = sinon
        .stub(disassociateUsagePlan, 'disassociateUsagePlan')
        .resolves()
    })

    afterEach(() => {
      awsCompileApigEvents.compileRestApi.restore()
      awsCompileApigEvents.compileResources.restore()
      awsCompileApigEvents.compileMethods.restore()
      awsCompileApigEvents.compileRequestValidators.restore()
      awsCompileApigEvents.compileDeployment.restore()
      awsCompileApigEvents.compileUsagePlan.restore()
      awsCompileApigEvents.compilePermissions.restore()
      awsCompileApigEvents.compileStage.restore()
      updateStage.updateStage.restore()
      disassociateUsagePlan.disassociateUsagePlan.restore()
    })

    it('should have hooks', () =>
      expect(awsCompileApigEvents.hooks).to.be.not.empty)

    it('should set the provider variable to be an instanceof AwsProvider', () =>
      expect(awsCompileApigEvents.provider).to.be.instanceof(AwsProvider))

    it('should setup an empty array to gather the method logical ids', () =>
      expect(awsCompileApigEvents.apiGatewayMethodLogicalIds).to.deep.equal([]))

    it('should run "package:compileEvents" promise chain in order', async () => {
      const validateStub = sinon
        .stub(awsCompileApigEvents, 'validate')
        .returns({
          events: [
            {
              functionName: 'first',
              http: {
                path: 'users',
                method: 'POST',
              },
            },
          ],
        })

      return awsCompileApigEvents.hooks['package:compileEvents']().then(() => {
        expect(validateStub.calledOnce).to.be.equal(true)
        expect(compileRestApiStub.calledAfter(validateStub)).to.be.equal(true)
        expect(
          compileResourcesStub.calledAfter(compileRestApiStub),
        ).to.be.equal(true)
        expect(
          compileMethodsStub.calledAfter(compileResourcesStub),
        ).to.be.equal(true)
        expect(
          compileRequestValidatorsStub.calledAfter(compileMethodsStub),
        ).to.be.equal(true)
        expect(
          compileDeploymentStub.calledAfter(compileRequestValidatorsStub),
        ).to.be.equal(true)
        expect(
          compileUsagePlanStub.calledAfter(compileDeploymentStub),
        ).to.be.equal(true)
        expect(
          compilePermissionsStub.calledAfter(compileUsagePlanStub),
        ).to.be.equal(true)
        expect(
          compileStageStub.calledAfter(compilePermissionsStub),
        ).to.be.equal(true)

        awsCompileApigEvents.validate.restore()
      })
    })

    describe('when running the "after:deploy:deploy" promise chain', () => {
      let getServiceStateStub

      beforeEach(() => {
        getServiceStateStub = sinon.stub(getServiceState, 'getServiceState')
      })

      afterEach(() => {
        getServiceState.getServiceState.restore()
      })

      it('should run the promise chain in order', async () => {
        getServiceStateStub.returns({
          service: {
            functions: {
              first: {
                events: [
                  {
                    http: {
                      path: 'users',
                      method: 'POST',
                    },
                  },
                ],
              },
            },
          },
        })

        return awsCompileApigEvents.hooks['after:deploy:deploy']().then(() => {
          expect(updateStageStub.calledOnce).to.equal(true)
        })
      })

      it('should not skip the updateStage step when no http events are found', async () => {
        getServiceStateStub.returns({
          service: {
            functions: {
              first: {
                events: [],
              },
            },
          },
        })

        return awsCompileApigEvents.hooks['after:deploy:deploy']().then(() => {
          expect(updateStageStub.calledOnce).to.equal(true)
        })
      })
    })

    it('should run "before:remove:remove" promise chain in order', async () => {
      const validateStub = sinon.stub(validate, 'validate').returns()

      return awsCompileApigEvents.hooks['before:remove:remove']().then(() => {
        expect(validateStub.calledOnce).to.equal(true)
        expect(disassociateUsagePlanStub.calledAfter(validateStub)).to.equal(
          true,
        )

        validate.validate.restore()
      })
    })

    it('should resolve if no functions are given', () => {
      awsCompileApigEvents.serverless.service.functions = {}

      return awsCompileApigEvents.hooks['package:compileEvents']()
    })
  })
})
