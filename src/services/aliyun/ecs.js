import { aliRequest } from './rpc'

const EP = 'https://ecs.aliyuncs.com'
const VER = '2014-05-26'
const base = (ak, sk) => ({ accessKeyId: ak, accessKeySecret: sk, endpoint: EP, apiVersion: VER })
const call = (c, action, params = {}) =>
  aliRequest({ ...base(c.accessKeyId, c.accessKeySecret), action, params })

export function createEcsClientAli(accessKeyId, accessKeySecret) {
  return { accessKeyId, accessKeySecret }
}

export const describeRegions = (c, t = {}) => call(c, 'DescribeRegions', t)
export const describeInstances = (c, t = {}) => call(c, 'DescribeInstances', t)
export const aliCreateCommand = (c, t) => call(c, 'CreateCommand', t)
export const aliInvokeCommand = (c, t) => call(c, 'InvokeCommand', t)
export const aliDescribeInvocationResults = (c, t) => call(c, 'DescribeInvocationResults', t)
export const aliDeleteCommand = (c, t) => call(c, 'DeleteCommand', t)
export const aliDescribeCommands = (c, t = {}) => call(c, 'DescribeCommands', t)
export const aliDescribeInvocations = (c, t = {}) => call(c, 'DescribeInvocations', t)
export const runCommand = (c, t) => call(c, 'RunCommand', t)
