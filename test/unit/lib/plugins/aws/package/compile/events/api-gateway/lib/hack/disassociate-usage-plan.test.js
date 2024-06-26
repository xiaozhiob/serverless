'use strict'

const expect = require('chai').expect
const sinon = require('sinon')
const Serverless = require('../../../../../../../../../../../lib/serverless')
const AwsProvider = require('../../../../../../../../../../../lib/plugins/aws/provider')
const disassociateUsagePlan = require('../../../../../../../../../../../lib/plugins/aws/package/compile/events/api-gateway/lib/hack/disassociate-usage-plan')

describe('#disassociateUsagePlan()', () => {
  let serverless
  let options
  let awsProvider
  let providerRequestStub

  beforeEach(() => {
    serverless = new Serverless({ commands: [], options: {} })
    serverless.service.service = 'my-service'
    serverless.cli = {
      log: sinon.spy(),
    }
    options = {
      stage: 'dev',
      region: 'us-east-1',
    }
    awsProvider = new AwsProvider(serverless, options)
    serverless.setProvider('aws', awsProvider)
    providerRequestStub = sinon.stub(awsProvider, 'request')

    disassociateUsagePlan.serverless = serverless
    disassociateUsagePlan.options = options
    disassociateUsagePlan.provider = awsProvider

    providerRequestStub
      .withArgs('CloudFormation', 'describeStackResource')
      .resolves({ StackResourceDetail: { PhysicalResourceId: 'resource-id' } })
    providerRequestStub.withArgs('APIGateway', 'getUsagePlans').resolves({
      items: [
        {
          apiStages: [
            {
              apiId: 'resource-id',
              stage: 'dev',
            },
          ],
          id: 'usage-plan-id',
        },
        {
          apiStages: [
            {
              apiId: 'another-resource-id',
              stage: 'dev',
            },
          ],
          id: 'another-usage-plan-id',
        },
      ],
    })
    providerRequestStub.withArgs('APIGateway', 'updateUsagePlan').resolves()
  })

  afterEach(() => {
    awsProvider.request.restore()
  })

  it('should remove association from the usage plan', async () => {
    disassociateUsagePlan.serverless.service.provider.apiGateway = {
      apiKeys: ['apiKey1'],
    }

    return disassociateUsagePlan.disassociateUsagePlan().then(() => {
      expect(providerRequestStub.callCount).to.be.equal(3)

      expect(
        providerRequestStub.calledWithExactly(
          'CloudFormation',
          'describeStackResource',
          {
            StackName: `${awsProvider.naming.getStackName()}`,
            LogicalResourceId: 'ApiGatewayRestApi',
          },
        ),
      ).to.be.equal(true)

      expect(
        providerRequestStub.calledWithExactly(
          'APIGateway',
          'getUsagePlans',
          {},
        ),
      ).to.be.equal(true)

      expect(
        providerRequestStub.calledWithExactly('APIGateway', 'updateUsagePlan', {
          usagePlanId: 'usage-plan-id',
          patchOperations: [
            {
              op: 'remove',
              path: '/apiStages',
              value: 'resource-id:dev',
            },
          ],
        }),
      ).to.be.equal(true)
    })
  })

  it('should resolve if no api keys are given', async () => {
    disassociateUsagePlan.serverless.service.provider.apiGateway = {
      apiKeys: [],
    }

    return disassociateUsagePlan.disassociateUsagePlan().then(() => {
      expect(providerRequestStub.callCount).to.be.equal(0)
    })
  })
})
