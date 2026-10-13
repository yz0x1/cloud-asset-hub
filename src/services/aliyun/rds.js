import { aliRequest } from './rpc'

const EP = 'https://rds.aliyuncs.com'
const VER = '2014-08-15'
const base = (ak, sk) => ({ accessKeyId: ak, accessKeySecret: sk, endpoint: EP, apiVersion: VER })
const call = (c, action, params = {}, timeout) =>
  aliRequest({
    ...base(c.accessKeyId, c.accessKeySecret),
    action,
    params,
    options: timeout ? { timeout } : {}
  })

export function aliCreateRdsClientAli(accessKeyId, accessKeySecret) {
  return { accessKeyId, accessKeySecret }
}
export const aliRdsDescribeRegions = (c, t = {}) =>
  call(c, 'DescribeRegions', { ...t, AcceptLanguage: 'zh-CN' })
export const aliRdsDescribeDBInstances = (c, t) => call(c, 'DescribeDBInstances', t)
export const aliRdsCreateAccount = (c, t) => call(c, 'CreateAccount', t, 50000)
export const aliRdsDescribeDatabases = (c, t) => call(c, 'DescribeDatabases', t)
export const aliRdsGrantAccountPrivilege = (c, t) => call(c, 'GrantAccountPrivilege', t, 50000)
export const aliRdsDeleteAccount = (c, t) => call(c, 'DeleteAccount', t, 50000)
export const aliRdsAllocateInstancePublicConnection = (c, t) =>
  call(c, 'AllocateInstancePublicConnection', t, 50000)
export const aliRdsReleaseInstancePublicConnection = (c, t) =>
  call(c, 'ReleaseInstancePublicConnection', t, 50000)
export const aliRdsModifySecurityIps = (c, t) => call(c, 'ModifySecurityIps', t, 50000)
export const aliRdsDescribeDBInstanceIPArrayList = (c, t) =>
  call(c, 'DescribeDBInstanceIPArrayList', t)
export const aliRdsDescribeAccounts = (c, t) => call(c, 'DescribeAccounts', t)
export const aliRdsDescribeDBInstanceNetInfo = (c, t) => call(c, 'DescribeDBInstanceNetInfo', t)
