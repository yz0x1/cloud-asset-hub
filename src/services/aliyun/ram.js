import { aliRequest } from './rpc'

const EP = 'https://ram.aliyuncs.com'
const VER = '2015-05-01'
const base = (ak, sk) => ({ accessKeyId: ak, accessKeySecret: sk, endpoint: EP, apiVersion: VER })

export function createRamClientAli(accessKeyId, accessKeySecret) {
  return { accessKeyId, accessKeySecret }
}
export function createImsClientAli(accessKeyId, accessKeySecret) {
  return { accessKeyId, accessKeySecret, _ims: true }
}
export const aliCreateUser = (c, t) =>
  aliRequest({ ...base(c.accessKeyId, c.accessKeySecret), action: 'CreateUser', params: t })
export const aliDeleteUser = (c, t) =>
  aliRequest({ ...base(c.accessKeyId, c.accessKeySecret), action: 'DeleteUser', params: t })
export const aliListUsers = (c, t = {}) =>
  aliRequest({ ...base(c.accessKeyId, c.accessKeySecret), action: 'ListUsers', params: t })
export const AttachPolicyToUser = (c, t) =>
  aliRequest({
    ...base(c.accessKeyId, c.accessKeySecret),
    action: 'AttachPolicyToUser',
    params: { PolicyType: 'System', PolicyName: 'AdministratorAccess', ...t }
  })
export const aliDetachPolicyFromUser = (c, t) =>
  aliRequest({
    ...base(c.accessKeyId, c.accessKeySecret),
    action: 'DetachPolicyFromUser',
    params: { PolicyType: 'System', PolicyName: 'AdministratorAccess', ...t }
  })
export const CreateLoginProfile = (c, t) =>
  aliRequest({ ...base(c.accessKeyId, c.accessKeySecret), action: 'CreateLoginProfile', params: t })
export const GetAccountAlias = (c) =>
  aliRequest({ ...base(c.accessKeyId, c.accessKeySecret), action: 'GetAccountAlias', params: {} })
