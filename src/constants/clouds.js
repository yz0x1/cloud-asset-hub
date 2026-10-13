/** 与原版 cloudVps / 对象存储 providers 对齐 */
export const CLOUD_VPS = {
  alibaba: { key: 'alibaba_cloud', name: '阿里云' },
  tencent: { key: 'tencent_cloud', name: '腾讯云' },
  huawei: { key: 'huawei_cloud', name: '华为云' },
  ucloud: { key: 'ucloud_cloud', name: 'ucloud' },
  aws: { key: 'aws_cloud', name: 'AWS' }
}

export const STORAGE_PROVIDERS = [
  { key: 'qiniu', name: '七牛云', features: ['urlUpload','customDomain','imageStyle','manualPrivateBucket','paging','refreshCDN'] },
  { key: 'tencent', name: '腾讯云', features: ['urlUpload','paging'] },
  { key: 'qingstor', name: '青云', features: ['urlUpload','paging'] },
  { key: 'aliyun', name: '阿里云', features: ['paging'] },
  { key: 'upyun', name: '又拍云', features: ['customDomain'] },
  { key: 'aws', name: 'AWS-S3', features: ['paging','manualPrivateBucket'] },
  { key: 'jd', name: '京东云', features: ['paging','manualPrivateBucket'] },
  { key: 'ks3', name: '金山云', features: ['paging'] },
  { key: 'minio', name: 'MinIO', features: ['paging','manualPrivateBucket'] }
]

/** 原版 OperationCodeList */
export const OPERATION_CODES = [
  { type: 'block_ip', label: '阻断' },
  { type: 'advance_mark_mis_info', label: '加白名单' },
  { type: 'ignore', label: '忽略' },
  { type: 'manual_handled', label: '我已手工处理' },
  { type: 'kill_process', label: '结束进程' },
  { type: 'cleanup', label: '深度查杀' },
  { type: 'kill_and_quara', label: '病毒查杀' },
  { type: 'disable_malicious_defense', label: '关闭恶意行为防御' },
  { type: 'client_problem_check', label: '问题排查' },
  { type: 'quara', label: '隔离' }
]

export const ALI_GJ_STATUS = [
  { type: 1, label: '待处理' },
  { type: 2, label: '已忽略' },
  { type: 4, label: '已确认' },
  { type: 8, label: '已标记误报' },
  { type: 16, label: '处理中' },
  { type: 32, label: '处理完毕' },
  { type: 64, label: '已经过期' }
]

/** 原版 ProjectNameList — 告警通知类型 */
export const NOTICE_PROJECTS = [
  { type: 'yundun_security_Weekreport', name: '漏洞通知' },
  { type: 'yundun_sas_antiransomware_task', name: '防勒索任务执行结果通知' },
  { type: 'sas_healthcheck', name: '基线检查通知' },
  { type: 'sas_suspicious', name: '态势感知安全告警通知' },
  { type: 'yundun_aegis_AV_true', name: '精准防御通知' },
  { type: 'yundun_sas_ak_leakage', name: 'AccessKey泄露情报通知' },
  { type: 'yundun_sas_config_alert', name: '云平台配置检查通知' },
  { type: 'yundun_sas_vul_Emergency', name: '应急漏洞情报通知' },
  { type: 'yundun_webguard_event', name: '网页防篡改通知' },
  { type: 'yundun_sas_cloud_native_firewall', name: '容器防火墙异常告警通知' },
  { type: 'yundun_sas_cloud_native_firewall_Defense', name: '容器防火墙主动防御通知' },
  { type: 'yundun_IP_Blocking', name: '恶意 IP 拦截告警通知' },
  { type: 'yundun_sas_anti_virus_config', name: '病毒扫描通知' },
  { type: 'yundun_sas_log', name: '日志超量通知' },
  { type: 'yundun_honeypot_alarm', name: '云蜜罐告警通知' },
  { type: 'aliyun_rasp_alarm', name: '应用安全告警通知' },
  { type: 'virusScheduleTask', name: '病毒防御定期扫描完成通知' },
  { type: 'yundun_anti_Virus', name: '未进行安全扫描通知' },
  { type: 'sas_vulnerability', name: '漏洞通知' },
  { type: 'weeklyreport', name: '周报通知' },
  { type: 'agent', name: '客户端离线通知' },
  { type: 'bruteforcesuccess', name: '防暴力破解通知' },
  { type: 'webshell', name: 'Webshell通知' },
  { type: 'suspicious', name: '安骑士告警通知' },
  { type: 'patch', name: '已废弃，无需关注' },
  { type: 'remotelogin', name: '远程登录通知' },
  { type: 'health', name: '安全检测通知' },
  { type: 'yundun_sas_cloudsiem_log', name: '威胁分析日志超量提醒通知' }
]

/**
 * 阿里云 ModifyNoticeConfig.Route（官方文档）
 * 0=关闭；位掩码 1短信 / 2邮件 / 4站内信
 */
export const NOTICE_ROUTES = [
  { type: 0, name: '关闭通知' },
  { type: 1, name: '短信开启' },
  { type: 2, name: '邮件开启' },
  { type: 4, name: '站内信开启' },
  { type: 3, name: '短信和邮件开启' },
  { type: 5, name: '短信和站内信开启' },
  { type: 6, name: '邮件和站内信开启' },
  { type: 7, name: '短信、邮件、站内信开启' }
]

/** 原版 TimeLimit 文案 */
export const NOTICE_TIME_LIMITS = [
  { type: 0, name: '无限制' },
  { type: 1, name: '08:00-22:00时间内发送通知' }
]
