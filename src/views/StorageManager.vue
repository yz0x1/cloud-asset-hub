<template>
  <div class="storage-root">
    <!-- ===== 资产列表 + 厂商内嵌表单（对齐原版：无弹窗） ===== -->
    <div v-if="pageMode==='assets'" class="assets-page">
      <div class="assets-subnav">
        <button
          class="subnav-item"
          :class="{ on: assetSubTab==='list' }"
          @click="switchAssetTab('list')"
        >资产列表</button>
        <button
          v-for="p in providers" :key="p.key"
          class="subnav-item"
          :class="{ on: assetSubTab===p.key }"
          @click="switchAssetTab(p.key)"
        >{{ p.name }}</button>
      </div>

      <!-- 图1：全部资产表格 -->
      <div v-if="assetSubTab==='list'" class="assets-list-pane">
        <div class="assets-toolbar">
          <el-input v-model="assetQuery" clearable placeholder="请输入 ak、sk" style="width:260px" />
          <el-button @click="showAk = !showAk">{{ showAk ? '隐藏' : '显示' }}</el-button>
          <el-button type="primary" plain @click="exportAssets">导出资产</el-button>
        </div>
        <el-table :data="filteredAssets" border stripe height="calc(100vh - 230px)" empty-text="暂无资产，点击上方厂商 Tab 添加">
          <el-table-column type="index" label="No" width="78" sortable>
            <template #default="{ $index, row }">
              <span>{{ $index + 1 }}</span>
              <el-tag v-if="row.temporary" size="small" type="primary" effect="plain" style="margin-left:4px">临时</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="名称" min-width="150" sortable>
            <template #default="{ row }">
              <span class="asset-name">
                <i class="prov-dot" :data-k="row.key"></i>
                {{ row.name || providerName(row.key) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="ak" min-width="200">
            <template #default="{ row }">{{ showAk ? row.access_key : mask(row.access_key) }}</template>
          </el-table-column>
          <el-table-column label="sk" min-width="160">
            <template #default="{ row }">{{ showAk ? row.secret_key : '********************************' }}</template>
          </el-table-column>
          <el-table-column label="创建时间" width="170" sortable>
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="120" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="loginAsset(row)">登入</el-button>
              <el-button link @click="editAsset(row)">编辑</el-button>
              <el-button link type="danger" @click="removeAsset(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 图2：厂商内嵌「设置密钥」表单 -->
      <div v-else class="assets-form-pane">
        <h3 class="form-title">设置{{ activeProvider?.name }}密钥</h3>
        <el-form
          ref="credFormRef"
          :model="credForm"
          :rules="credRules"
          label-width="130px"
          class="cred-form"
          @submit.prevent
        >
          <el-form-item label="别名" prop="name">
            <el-input v-model="credForm.name" placeholder="别名" style="max-width:420px" />
          </el-form-item>

          <template v-if="assetSubTab==='upyun'">
            <el-form-item label="服务名" prop="service_name" required>
              <el-input v-model="credForm.service_name" placeholder="又拍云服务名" style="max-width:420px" />
            </el-form-item>
            <el-form-item label="操作员名" prop="access_key">
              <el-input v-model="credForm.access_key" placeholder="请填入操作员名" style="max-width:420px" />
            </el-form-item>
            <el-form-item label="操作员密码" prop="secret_key">
              <el-input v-model="credForm.secret_key" type="password" show-password placeholder="请填入操作员密码" style="max-width:420px" />
            </el-form-item>
          </template>
          <template v-else>
            <el-form-item label="ACCESS_KEY" prop="access_key">
              <el-input v-model="credForm.access_key" placeholder="请填入你的 ACCESS_KEY" style="max-width:420px" />
            </el-form-item>
            <el-form-item label="SECRET_KEY" prop="secret_key">
              <el-input v-model="credForm.secret_key" type="password" show-password placeholder="请填入你的 SECRET_KEY" style="max-width:420px" />
            </el-form-item>
          </template>

          <el-form-item v-if="assetSubTab==='aliyun'" label="STS_TOKEN">
            <el-input v-model="credForm.sts_token" placeholder="可选，STS 临时凭证" style="max-width:420px" />
          </el-form-item>

          <el-form-item v-if="showCredRegion" label="Region">
            <el-input v-model="credForm.region" :placeholder="regionPlaceholder" style="max-width:420px" />
          </el-form-item>
          <el-form-item v-if="showCredEndpoint" label="ENDPOINT">
            <el-input v-model="credForm.endpoint" placeholder="如 http://127.0.0.1:9000" style="max-width:420px" />
          </el-form-item>
          <el-form-item v-if="['qiniu','upyun'].includes(assetSubTab)" label="域名">
            <el-input v-model="credForm.domain" placeholder="自定义/外链域名（可选）" style="max-width:420px" />
          </el-form-item>

          <el-form-item label="备注">
            <el-input
              v-model="credForm.notes"
              type="textarea"
              :rows="3"
              maxlength="100"
              show-word-limit
              placeholder="备注"
              style="max-width:420px"
            />
          </el-form-item>

          <el-form-item v-if="assetSubTab==='aliyun'" label="内网访问">
            <el-switch v-model="credForm.internal" />
          </el-form-item>
          <el-form-item label="分页">
            <el-switch v-model="credForm.paging" />
            <el-tooltip content="开启后对象列表按页拉取，适合大桶" placement="top">
              <span class="help-ico">?</span>
            </el-tooltip>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="credSaving" @click="submitCredAndEnter">
              {{ credForm.id ? '保存并进入' : '设置并进入' }}
            </el-button>
            <el-button @click="resetCredForm" style="margin-left:8px">重置</el-button>
          </el-form-item>
        </el-form>
        <p class="cred-hint">
          * 如何获取密钥信息：登录
          <a href="#" @click.prevent="openKeyHelp">{{ activeProvider?.name }}控制台</a>
          → AccessKey
        </p>
      </div>
    </div>

    <!-- ===== 存储浏览器 ===== -->
    <div v-else class="storage-page">
      <aside class="side browser-side">
        <button type="button" class="side-account" @click="pageMode='assets'">
          <span class="acc-mark" :data-k="current?.key || activeAsset?.key || ''">☁</span>
          <span class="acc-text">
            <strong>{{ activeAsset?.name || current?.name || '账号' }}</strong>
            <small>{{ current?.name || providerName(current?.key) }} · 返回列表</small>
          </span>
        </button>
        <div class="side-hd">
          <span>存储空间</span>
          <button type="button" class="side-mini" title="刷新空间列表" @click="loadBuckets">↻</button>
        </div>
        <div class="bucket-list">
          <button
            v-for="b in buckets" :key="b.name"
            type="button"
            class="bucket-item"
            :class="{ active: bucket===b.name }"
            @click="onBucket(b)"
          >
            <span class="b-ico" aria-hidden="true">▣</span>
            <span class="b-name" :title="b.name">{{ b.name }}</span>
          </button>
          <div v-if="!buckets.length" class="side-empty">点右上角 ↻ 加载空间</div>
        </div>
        <div class="side-foot">
          <button type="button" @click="pageMode='assets'">资产</button>
          <button type="button" @click="optVisible=true">选项</button>
        </div>
      </aside>

      <section class="main">
        <header class="main-hd">
          <div class="hd-left">
            <div class="hd-title-row">
              <h2>{{ bucket || '请选择存储空间' }}</h2>
              <el-tag v-if="current?.name" size="small" effect="plain" type="info">{{ current.name }}</el-tag>
            </div>
            <p class="sub">{{ fileStats.count }} 个对象 · {{ fileStats.sizeLabel }}</p>
          </div>
          <div class="hd-actions">
            <el-button-group>
              <el-button size="small" :type="layoutMode==='grid' ? 'primary' : 'default'" @click="layoutMode='grid'">网格</el-button>
              <el-button size="small" :type="layoutMode==='list' ? 'primary' : 'default'" @click="layoutMode='list'">列表</el-button>
            </el-button-group>
            <el-button size="small" @click="logsVisible=true">上传记录</el-button>
            <el-button size="small" @click="optVisible=true">空间选项</el-button>
          </div>
        </header>

        <el-form v-if="!activeAsset" class="cred" inline>
          <el-form-item label="AK/SK">
            <el-input v-model="manual.ak" style="width:130px" placeholder="AK" />
            <el-input v-model="manual.sk" show-password style="width:130px;margin-left:6px" placeholder="SK" />
          </el-form-item>
          <el-form-item v-if="showRegion" label="Region"><el-input v-model="region" style="width:130px" /></el-form-item>
          <el-form-item v-if="needsEndpoint" label="Endpoint"><el-input v-model="endpoint" style="width:200px" /></el-form-item>
          <el-form-item v-if="opts.customDomain || current?.key==='qiniu'" label="域名">
            <el-input v-model="domain" style="width:160px" />
          </el-form-item>
          <el-button type="primary" :loading="loading" @click="loadBuckets">列出空间</el-button>
        </el-form>

        <div class="obj-pane full"
          @dragover.prevent="dragOver=true"
          @dragleave.prevent="dragOver=false"
          @drop.prevent="onDrop"
          :class="{ drag: dragOver }"
        >
            <div class="crumb-row">
              <el-breadcrumb separator="/">
                <el-breadcrumb-item><a href="#" @click.prevent="goPrefix('')">根目录</a></el-breadcrumb-item>
                <el-breadcrumb-item v-for="(c,i) in crumbs" :key="i">
                  <a href="#" @click.prevent="goPrefix(crumbPath(i))">{{ c }}</a>
                </el-breadcrumb-item>
              </el-breadcrumb>
              <el-input v-model="search" size="small" clearable placeholder="搜索文件名" class="search-inp" />
            </div>

            <div class="toolbar">
              <div class="tb-group">
                <el-button size="small" :disabled="!bucket" :loading="loading" @click="reloadObjects">刷新</el-button>
                <el-button size="small" :disabled="!canMkdir" @click="doMkdir">新建目录</el-button>
              </div>
              <span class="tb-sep" aria-hidden="true"></span>
              <div class="tb-group">
                <el-button size="small" type="primary" :disabled="!canRW" @click="doUpload">上传</el-button>
                <el-button size="small" :disabled="!canRW" @click="doUploadMulti">多选</el-button>
                <el-button size="small" :disabled="!canRW" @click="doUploadFolder">文件夹</el-button>
                <el-button
                  v-if="hasFeature('urlUpload') || opts.urlUpload"
                  size="small"
                  :disabled="!canRW"
                  @click="urlDlgVisible=true"
                >URL</el-button>
              </div>
              <span class="tb-sep" aria-hidden="true"></span>
              <div class="tb-group">
                <el-button size="small" :disabled="!selected.length" @click="doBatchDownload">
                  下载{{ selected.length ? ` ${selected.length}` : '' }}
                </el-button>
                <el-button
                  v-if="!opts.hideDeleteBtn"
                  size="small"
                  type="danger"
                  plain
                  :disabled="!selected.length || !canRW"
                  @click="doBatchDelete"
                >删除{{ selected.length ? ` ${selected.length}` : '' }}</el-button>
                <el-button size="small" @click="selectAllToggle">全选</el-button>
                <el-button size="small" :disabled="!selected.length" @click="exportUrls">导出 URL</el-button>
              </div>
              <span class="tb-sep" aria-hidden="true"></span>
              <div class="tb-group">
                <el-button size="small" :disabled="!bucket" @click="openSync">同步</el-button>
                <el-button
                  v-if="hasFeature('refreshCDN') || current?.key==='qiniu'"
                  size="small"
                  type="warning"
                  plain
                  :disabled="!selected.length"
                  @click="cdnFromSelection"
                >CDN</el-button>
                <el-button size="small" :disabled="!opts.paging || !pageInfo.isTruncated" @click="loadMore">下一页</el-button>
              </div>
              <div class="tb-grow"></div>
              <span v-if="selected.length" class="tb-hint">已选 {{ selected.length }}</span>
            </div>

            <!-- 网格缩略图（对齐原版图1） -->
            <div v-if="layoutMode==='grid'" class="grid-view" v-loading="loading">
              <div
                v-for="row in filteredRows" :key="row.name"
                class="grid-card"
                :class="{ selected: isSelected(row), dir: row.isDir }"
                @click="onGridClick(row, $event)"
                @dblclick="onRowDbl(row)"
                @contextmenu.prevent="onRowContext(row, null, $event)"
              >
                <div class="thumb">
                  <template v-if="row.isDir">
                    <div class="folder-ico">📁</div>
                  </template>
                  <template v-else-if="isImage(row.name)">
                    <img
                      v-if="thumbMap[row.name] && thumbMap[row.name] !== '__fail__'"
                      :src="thumbMap[row.name]"
                      loading="lazy"
                      @error="onThumbErr(row)"
                    />
                    <div v-else-if="thumbMap[row.name] === '__fail__'" class="file-ico">{{ fileExtLabel(row.name) }}</div>
                    <div v-else class="thumb-loading">预览中…</div>
                  </template>
                  <template v-else>
                    <div class="file-ico">{{ fileExtLabel(row.name) }}</div>
                  </template>
                </div>
                <div class="gname" :title="displayName(row)">{{ displayName(row) }}</div>
              </div>
              <div v-if="!filteredRows.length" class="grid-empty">空目录或尚未选择空间</div>
            </div>

            <el-table
              v-else
              ref="tableRef"
              :data="filteredRows"
              height="520"
              v-loading="loading"
              @selection-change="r => selected=r"
              @row-dblclick="onRowDbl"
              @row-contextmenu="onRowContext"
              size="small"
            >
              <el-table-column type="selection" width="42" :selectable="r => !r.isDir" />
              <el-table-column label="预览" width="72">
                <template #default="{ row }">
                  <img
                    v-if="!row.isDir && isImage(row.name) && thumbMap[row.name] && thumbMap[row.name] !== '__fail__'"
                    :src="thumbMap[row.name]"
                    class="list-thumb"
                    @error="onThumbErr(row)"
                  />
                  <span v-else-if="row.isDir">📁</span>
                  <span v-else class="ext-mini">{{ fileExtLabel(row.name) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="名称" min-width="240">
                <template #default="{ row }">
                  <span class="name" :class="{ dir: row.isDir }" @click="row.isDir && enterDir(row)">
                    {{ displayName(row) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="size" label="大小" width="90" />
              <el-table-column prop="lastModified" label="修改时间" width="170" />
              <el-table-column label="操作" :width="opts.hideDeleteBtn ? 360 : 420" fixed="right">
                <template #default="{ row }">
                  <template v-if="!row.isDir">
                    <el-button link :disabled="!canRW" @click="doDownload(row)">下载</el-button>
                    <el-button link :disabled="!canSign" @click="doPreview(row)">预览</el-button>
                    <el-button link :disabled="!canMove" @click="doRename(row)">重命名</el-button>
                    <el-button link :disabled="!canMove" @click="doMove(row)">移动</el-button>
                    <el-button link @click="copySmart(row)">复制</el-button>
                    <el-button link @click="copyPath(row)">路径</el-button>
                    <el-button v-if="!opts.hideDeleteBtn" link type="danger" :disabled="!canRW" @click="doDelete(row)">删除</el-button>
                  </template>
                  <el-button v-else link @click="enterDir(row)">打开</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-input v-if="lastUrl" v-model="lastUrl" type="textarea" :rows="2" class="urlbox" readonly />
        </div>
      </section>
    </div>

    <!-- options -->
    <el-dialog v-model="optVisible" title="空间选项（对齐原版）" width="520px">
      <el-form label-width="160px">
        <el-form-item v-if="hasFeature('customDomain')" label="自定义域名"><el-switch v-model="opts.customDomain" /></el-form-item>
        <el-form-item v-if="hasFeature('urlUpload')" label="URL直传"><el-switch v-model="opts.urlUpload" /></el-form-item>
        <el-form-item v-if="hasFeature('imageStyle')" label="图床/图片样式">
          <el-input v-model="opts.imageStyle" placeholder="imageView2/2/w/800" />
        </el-form-item>
        <el-form-item label="HTTPS"><el-switch v-model="opts.https" /></el-form-item>
        <el-form-item label="直接删除,不显示确认框"><el-switch v-model="opts.hideDeleteConfirm" /></el-form-item>
        <el-form-item label="直接上传,不显示确认框"><el-switch v-model="opts.uploadNoAsk" /></el-form-item>
        <el-form-item label="如果文件已存在,是否覆盖上传"><el-switch v-model="opts.askOverwrite" /></el-form-item>
        <el-form-item v-if="hasFeature('paging')" label="开启分页"><el-switch v-model="opts.paging" /></el-form-item>
        <el-form-item v-if="hasFeature('manualPrivateBucket')" label="私有空间"><el-switch v-model="opts.manualPrivateBucket" /></el-form-item>
        <el-form-item label="隐藏删除按钮"><el-switch v-model="opts.hideDeleteBtn" /></el-form-item>
        <el-form-item label="复制格式">
          <el-radio-group v-model="opts.copyType">
            <el-radio value="url">url</el-radio>
            <el-radio value="markdown">markdown</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="urlDlgVisible" title="通过url直接上传文件" width="520px">
      <el-input v-model="urlUploadSrc" type="textarea" :rows="3" placeholder="请输入你要上传的文件链接" />
      <template #footer>
        <el-button @click="urlDlgVisible=false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="doUrlUpload">上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logsVisible" title="上传记录" width="640px">
      <div v-if="!uploadLogs.length" class="empty-logs">暂无上传记录</div>
      <div v-for="(t,i) in uploadLogs" :key="i" class="log-item">
        <div class="log-key">{{ t.key }}</div>
        <div class="log-meta">{{ t.time }} · {{ t.ok ? '成功' : '失败' }} {{ t.size || '' }}</div>
        <div class="log-btns">
          <el-button size="small" @click="lastUrl=t.url||t.key">查看</el-button>
          <el-button size="small" @click="copyText(t.url||t.key,'已复制')">复制路径</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="uploadLogs=[]">清空</el-button>
        <el-button type="primary" @click="logsVisible=false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="accVisible" title="保存存储账号" width="480px">
      <el-form label-width="90px">
        <el-form-item label="别名"><el-input v-model="accForm.name" /></el-form-item>
        <el-form-item label="厂商">
          <el-select v-model="accForm.key" style="width:100%">
            <el-option v-for="p in providers" :key="p.key" :label="p.name" :value="p.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="AK"><el-input v-model="accForm.access_key" /></el-form-item>
        <el-form-item label="SK"><el-input v-model="accForm.secret_key" show-password /></el-form-item>
        <el-form-item label="Region"><el-input v-model="accForm.region" /></el-form-item>
        <el-form-item label="Endpoint"><el-input v-model="accForm.endpoint" /></el-form-item>
        <el-form-item label="域名"><el-input v-model="accForm.domain" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="accForm.notes" placeholder="如：oss对象存储" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="accVisible=false">取消</el-button>
        <el-button type="primary" @click="saveAcc">{{ accForm.id ? '保存' : '保存并查找' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="cdnVisible" title="刷新CDN" width="520px">
      <el-input v-model="cdnUrls" type="textarea" :rows="6" placeholder="每行一个 URL" />
      <template #footer>
        <el-button @click="cdnVisible=false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="doRefreshCdn">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewVisible" title="预览" width="70%">
      <img v-if="previewIsImg" :src="previewUrl" style="max-width:100%;max-height:70vh" />
      <iframe v-else-if="previewUrl" :src="previewUrl" style="width:100%;height:70vh;border:0" />
    </el-dialog>

    <el-dialog v-model="syncVisible" title="请选择同步方式" width="560px">
      <el-radio-group v-model="syncMode" class="sync-modes">
        <el-radio :value="0">合并</el-radio>
        <el-radio :value="1">覆盖云盘(以本地文件为基准,云盘未对应的文件会被删除)</el-radio>
        <el-radio :value="2">覆盖本地(以云盘文件为基准,本地未对应的文件会被删除)</el-radio>
      </el-radio-group>
      <div v-if="syncPlan" class="sync-stats">
        计划：上传 {{ syncPlan.stats?.upload || 0 }} · 下载 {{ syncPlan.stats?.download || 0 }} ·
        删云 {{ syncPlan.stats?.deleteCloud || 0 }} · 本地标记 {{ syncPlan.stats?.deleteLocal || 0 }}
      </div>
      <template #footer>
        <el-button @click="syncVisible=false">取消</el-button>
        <el-button :loading="loading" @click="prepareSync">选择本地目录并规划</el-button>
        <el-button type="primary" :loading="loading" :disabled="!syncPlan" @click="runSync">执行同步</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="详情" width="520px">
      <pre class="detail">{{ detailText }}</pre>
    </el-dialog>

    <!-- 右键菜单 -->
    <ul
      v-show="ctx.visible"
      class="ctx-menu"
      :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }"
      @click.stop
    >
      <li @click="ctxAction('detail')">详情</li>
      <li v-if="!ctx.row?.isDir" @click="ctxAction('preview')">预览</li>
      <li v-if="!ctx.row?.isDir" @click="ctxAction('download')">下载</li>
      <li @click="ctxAction('rename')">重命名</li>
      <li @click="ctxAction('move')">移动</li>
      <li v-if="!ctx.row?.isDir" @click="ctxAction('copy')">复制链接</li>
      <li v-if="!ctx.row?.isDir" @click="ctxAction('md')">复制链接(Markdown)</li>
      <li @click="ctxAction('select')">选择</li>
      <li @click="ctxAction('selectAll')">全选</li>
      <li v-if="current?.key==='qiniu' && !ctx.row?.isDir" @click="ctxAction('cdn')">刷新CDN</li>
      <li v-if="!opts.hideDeleteBtn" class="danger" @click="ctxAction('delete')">删除</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { STORAGE_PROVIDERS, CLOUD_VPS } from '@/constants/clouds'
import { useVpsStore } from '@/stores/vps'
import { useStorageStore } from '@/stores/storage'
import { loadStore } from '@/services/store'
import {
  ossBuckets, ossObjects, cosBuckets, cosObjects,
  qiniuBuckets, qiniuObjects, upyunObjects,
  s3Buckets, s3Objects, qingstorBuckets, qingstorObjects,
  storagePut, storageGet, storageSign, storageDelete, storageMkdir, storageMove, qiniuRefreshCdn
} from '@/services/cloud'

const S3 = new Set(['aws', 'minio', 'ks3', 'jd'])
const RW = new Set(['aliyun', 'tencent', 'qiniu', 'qingstor', 'upyun', 'aws', 'minio', 'ks3', 'jd'])

const providers = STORAGE_PROVIDERS
const store = useVpsStore()
const stStore = useStorageStore()
const tableRef = ref(null)

const pageMode = ref('assets') // assets | browser — 对齐原版资产列表→登入
const layoutMode = ref('grid') // grid | list — 默认网格缩略图
const assetSubTab = ref('list') // list | providerKey — 原版二级 Tab
const showAk = ref(false)
const assetQuery = ref('')
const activeAsset = ref(null)
const thumbMap = reactive({})
const credFormRef = ref(null)
const credSaving = ref(false)
const credForm = reactive({
  id: null,
  name: '',
  key: 'aliyun',
  access_key: '',
  secret_key: '',
  sts_token: '',
  region: '',
  endpoint: '',
  service_name: '',
  domain: '',
  notes: '',
  internal: false,
  paging: false
})
const credRules = {
  access_key: [{ required: true, message: '参数不能为空', trigger: 'blur' }],
  secret_key: [{ required: true, message: '参数不能为空', trigger: 'blur' }],
  service_name: [{ required: true, message: 'service_name不能为空', trigger: 'blur' }]
}
const current = ref(null)
const loading = ref(false)
const akId = ref('')
const savedId = ref('')
const region = ref('oss-cn-hangzhou')
const cosRegion = ref('ap-guangzhou')
const endpoint = ref('')
const domain = ref('')
const qingZone = ref('pek3a')
const buckets = ref([])
const bucket = ref('')
const objects = ref([])
const prefixes = ref([])
const prefix = ref('')
const selected = ref([])
const lastUrl = ref('')
const dragOver = ref(false)
const manual = reactive({ ak: '', sk: '' })
const upyun = reactive({ service: '', operator: '', password: '', path: '/' })
const opts = reactive({
  customDomain: true, urlUpload: false, imageStyle: '', https: true,
  hideDeleteConfirm: false, uploadNoAsk: false, askOverwrite: true, paging: true,
  manualPrivateBucket: false, hideDeleteBtn: false, copyType: 'url', deadlineMin: 60
})
const pageInfo = reactive({ nextMarker: null, isTruncated: false })
const optVisible = ref(false)
const accVisible = ref(false)
const cdnVisible = ref(false)
const previewVisible = ref(false)
const previewUrl = ref('')
const urlUploadSrc = ref('')
const urlDlgVisible = ref(false)
const logsVisible = ref(false)
const uploadLogs = ref([])
const search = ref('')
const downloadDir = ref('')
const cdnUrls = ref('')
const syncVisible = ref(false)
const syncMode = ref(0)
const syncPlan = ref(null)
const syncLocalDir = ref('')
const detailVisible = ref(false)
const detailText = ref('')
const ctx = reactive({ visible: false, x: 0, y: 0, row: null })
const accForm = reactive({
  name: '', key: 'aliyun', access_key: '', secret_key: '',
  region: '', endpoint: '', domain: '', notes: '', id: null
})

const canRW = computed(() => RW.has(current.value?.key))
const canSign = computed(() => ['aliyun', 'tencent', 'qiniu', 'aws', 'minio', 'ks3', 'jd'].includes(current.value?.key))
const canMkdir = computed(() => ['aliyun', 'tencent', 'qingstor', 'upyun', 'aws', 'minio', 'ks3', 'jd'].includes(current.value?.key))
const canMove = computed(() => ['aliyun', 'tencent', 'qiniu', 'qingstor', 'upyun', 'aws', 'minio', 'ks3', 'jd'].includes(current.value?.key))
const showRegion = computed(() => current.value?.key === 'aliyun' || S3.has(current.value?.key))
const needsEndpoint = computed(() => ['minio', 'ks3', 'jd'].includes(current.value?.key))
const previewIsImg = computed(() => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(previewUrl.value))
const savedForProvider = computed(() => stStore.list.filter(x => !current.value || x.key === current.value.key))
const akOptions = computed(() => {
  const k = current.value?.key
  if (k === 'aliyun') return store.list.filter(v => v.name === CLOUD_VPS.alibaba.name)
  if (k === 'tencent') return store.list.filter(v => v.name === CLOUD_VPS.tencent.name)
  if (k === 'aws') return store.list.filter(v => v.name === CLOUD_VPS.aws.name)
  return store.list
})
const displayRows = computed(() => [...prefixes.value, ...objects.value])
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return displayRows.value
  return displayRows.value.filter(r => String(r.name || '').toLowerCase().includes(q))
})
const filteredAssets = computed(() => {
  const q = assetQuery.value.trim().toLowerCase()
  if (!q) return stStore.list
  return stStore.list.filter(a =>
    String(a.access_key || '').toLowerCase().includes(q) ||
    String(a.secret_key || '').toLowerCase().includes(q) ||
    String(a.name || '').toLowerCase().includes(q) ||
    String(a.notes || '').toLowerCase().includes(q)
  )
})
const fileStats = computed(() => {
  const files = objects.value.filter(o => !o.isDir)
  const sum = files.reduce((s, o) => s + (Number(o.size) || 0), 0)
  return { count: files.length + prefixes.value.length, sizeLabel: formatSize(sum) }
})
const crumbs = computed(() => prefix.value.split('/').filter(Boolean))
const signExpires = computed(() => Math.max(60, (opts.deadlineMin || 60) * 60))
const activeProvider = computed(() => providers.find(p => p.key === assetSubTab.value) || null)
const showCredRegion = computed(() => ['aliyun', 'aws', 'jd', 'ks3', 'minio', 'qingstor'].includes(assetSubTab.value))
const showCredEndpoint = computed(() => ['minio', 'ks3', 'jd'].includes(assetSubTab.value))
const regionPlaceholder = computed(() => {
  const m = {
    aliyun: 'oss-cn-hangzhou',
    aws: 'us-east-1',
    jd: 'cn-north-1',
    ks3: 'BEIJING',
    minio: 'us-east-1',
    qingstor: 'pek3a'
  }
  return m[assetSubTab.value] || 'region'
})
const KEY_HELP = {
  qiniu: 'https://portal.qiniu.com/user/key',
  tencent: 'https://console.cloud.tencent.com/cam/capi',
  aliyun: 'https://ram.console.aliyun.com/manage/ak',
  aws: 'https://console.aws.amazon.com/iam/',
  qingstor: 'https://console.qingcloud.com/access_keys/',
  upyun: 'https://console.upyun.com/',
  jd: 'https://iam-console.jdcloud.com/',
  ks3: 'https://uc.console.ksyun.com/pro/iam/#/accessKey',
  minio: 'https://min.io/docs/minio/linux/administration/identity-access-management.html'
}

function providerName(key) {
  return providers.find(p => p.key === key)?.name || key
}
function defaultCredName(key) {
  const p = providers.find(x => x.key === key)
  const n = stStore.list.filter(x => x.key === key).length + 1
  return (p?.name || key) + '-' + n
}
function resetCredForm() {
  const key = assetSubTab.value === 'list' ? 'aliyun' : assetSubTab.value
  Object.assign(credForm, {
    id: null,
    name: defaultCredName(key),
    key,
    access_key: '',
    secret_key: '',
    sts_token: '',
    region: regionPlaceholder.value === 'region' ? '' : regionPlaceholder.value,
    endpoint: key === 'minio' ? 'http://127.0.0.1:9000'
      : key === 'ks3' ? 'https://ks3-cn-beijing.ksyun.com'
        : key === 'jd' ? 'https://s3.cn-north-1.jdcloud-oss.com' : '',
    service_name: '',
    domain: '',
    notes: '',
    internal: false,
    paging: false
  })
  credFormRef.value?.clearValidate?.()
}
function switchAssetTab(tab) {
  assetSubTab.value = tab
  if (tab !== 'list') resetCredForm()
}
function openKeyHelp() {
  const url = KEY_HELP[assetSubTab.value]
  if (url && window.akShell?.openExternal) window.akShell.openExternal(url)
  else if (url) window.open(url, '_blank')
}
async function submitCredAndEnter() {
  if (!activeProvider.value) return
  const form = credFormRef.value
  if (form) {
    try { await form.validate() } catch { return }
  }
  if (!credForm.access_key || !credForm.secret_key) {
    return ElMessage.error('请填写 ACCESS_KEY / SECRET_KEY')
  }
  if (assetSubTab.value === 'upyun' && !credForm.service_name) {
    return ElMessage.error('service_name不能为空')
  }
  credSaving.value = true
  try {
    const payload = {
      id: credForm.id,
      name: credForm.name || defaultCredName(assetSubTab.value),
      key: assetSubTab.value,
      access_key: credForm.access_key,
      secret_key: credForm.secret_key,
      sts_token: credForm.sts_token,
      region: credForm.region,
      endpoint: credForm.endpoint,
      service_name: assetSubTab.value === 'upyun' ? credForm.service_name : '-',
      domain: credForm.domain,
      notes: credForm.notes,
      internal: credForm.internal,
      paging: credForm.paging
    }
    let row
    if (payload.id) {
      await stStore.update(payload)
      row = stStore.list.find(x => x.id === payload.id)
      ElMessage.success('修改成功')
    } else {
      row = await stStore.add(payload)
      ElMessage.success('已保存，正在进入…')
    }
    if (row) await loginAsset(row)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    credSaving.value = false
  }
}
function formatTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return String(t)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function formatSize(n) {
  const v = Number(n) || 0
  if (v < 1024) return v + ' B'
  if (v < 1024 * 1024) return (v / 1024).toFixed(2) + ' KB'
  if (v < 1024 * 1024 * 1024) return (v / 1024 / 1024).toFixed(2) + ' MB'
  return (v / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}
function isImage(name) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(name || ''))
}
function fileExtLabel(name) {
  const m = String(name || '').match(/\.([a-z0-9]+)$/i)
  return (m ? m[1] : 'FILE').toUpperCase().slice(0, 4)
}
function isSelected(row) {
  return selected.value.some(s => s.name === row.name)
}
function onGridClick(row, e) {
  if (e.ctrlKey || e.metaKey) {
    const i = selected.value.findIndex(s => s.name === row.name)
    if (i >= 0) selected.value.splice(i, 1)
    else if (!row.isDir) selected.value.push(row)
    return
  }
  if (row.isDir) enterDir(row)
  else selected.value = [row]
}
function onThumbErr(row) {
  // 签名链失败才标 fail，避免灰块死循环重试
  thumbMap[row.name] = '__fail__'
}
function defaultObjectUrl(key) {
  const k = current.value?.key
  const host = String(key || '').replace(/^\//, '')
  if (!bucket.value || !host) return ''
  if (k === 'aliyun') {
    const reg = (region.value || 'oss-cn-hangzhou').replace(/^oss-/, 'oss-')
    return `https://${bucket.value}.${reg}.aliyuncs.com/${host}`
  }
  if (k === 'tencent' && cosRegion.value) {
    return `https://${bucket.value}.cos.${cosRegion.value}.myqcloud.com/${host}`
  }
  if (k === 'aws' && region.value) {
    return `https://${bucket.value}.s3.${region.value}.amazonaws.com/${host}`
  }
  return ''
}
async function signThumbUrl(objectKey) {
  if (!canSign.value) return ''
  const ak = rowAk()
  if (!ak) return ''
  const r = await storageSign(current.value.key, ak, {
    ...signOpts(objectKey),
    expires: Math.min(signExpires.value || 3600, 900)
  })
  return r?.url || ''
}
async function loadThumbs() {
  const imgs = filteredRows.value.filter(r => !r.isDir && isImage(r.name)).slice(0, 80)
  for (const row of imgs) {
    if (thumbMap[row.name] && thumbMap[row.name] !== '__fail__') continue
    try {
      let u = ''
      // 私有桶优先预签名；自定义域名公开桶可用 publicUrl
      if (canSign.value) {
        try { u = await signThumbUrl(row.name) } catch (e) {
          console.warn('[thumb] sign fail', row.name, e.message || e)
        }
      }
      if (!u && !opts.manualPrivateBucket) {
        u = publicUrl(row.name) || defaultObjectUrl(row.name)
      }
      thumbMap[row.name] = u || '__fail__'
    } catch {
      thumbMap[row.name] = '__fail__'
    }
  }
}

function hideCtx() { ctx.visible = false }
onMounted(async () => {
  await store.init()
  await stStore.init()
  await loadAppSettings()
  window.addEventListener('click', hideCtx)
  window.addEventListener('scroll', hideCtx, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('click', hideCtx)
  window.removeEventListener('scroll', hideCtx, true)
})
async function loadAppSettings() {
  try {
    const data = await loadStore()
    const s = data.settings || {}
    if (s.downloadDir) downloadDir.value = s.downloadDir
    if (s.copyType) opts.copyType = s.copyType
    if (s.deadlineMin) opts.deadlineMin = s.deadlineMin
    if (s.imageStyle) opts.imageStyle = s.imageStyle
    if (!downloadDir.value && window.akDialog?.defaultDownload) {
      downloadDir.value = await window.akDialog.defaultDownload()
    }
  } catch {}
}
function applySearch() { /* filteredRows 已响应 */ }
function pushLog(entry) {
  uploadLogs.value.unshift({ time: new Date().toLocaleString(), ...entry })
  if (uploadLogs.value.length > 200) uploadLogs.value.length = 200
}

function mask(s) {
  if (!s) return ''
  if (s.length <= 8) return '****'
  return s.slice(0, 4) + 'x'.repeat(Math.min(20, s.length - 8)) + s.slice(-4)
}
function hasFeature(f) { return (current.value?.features || []).includes(f) }

async function loginAsset(row) {
  const p = providers.find(x => x.key === row.key)
  if (!p) return ElMessage.error('未知厂商')
  activeAsset.value = row
  open(p)
  savedId.value = row.id
  onSavedPick()
  manual.ak = row.access_key
  manual.sk = row.secret_key
  if (row.region) region.value = row.region
  if (row.endpoint) endpoint.value = row.endpoint
  if (row.domain) {
    domain.value = row.domain
    opts.customDomain = true
  }
  opts.paging = row.paging != null ? !!row.paging : hasFeature('paging')
  if (row.key === 'upyun') {
    upyun.service = row.service_name || ''
    upyun.operator = row.access_key || ''
    upyun.password = row.secret_key || ''
  }
  pageMode.value = 'browser'
  layoutMode.value = 'grid'
  await loadBuckets()
  if (buckets.value[0]) onBucket(buckets.value[0])
}
function editAsset(row) {
  // 编辑走内嵌表单，不弹窗
  assetSubTab.value = row.key
  Object.assign(credForm, {
    id: row.id,
    name: row.name || '',
    key: row.key,
    access_key: row.access_key || '',
    secret_key: row.secret_key || '',
    sts_token: row.sts_token || '',
    region: row.region || '',
    endpoint: row.endpoint || '',
    service_name: row.service_name || '',
    domain: row.domain || '',
    notes: row.notes || '',
    internal: !!row.internal,
    paging: !!row.paging
  })
}
async function removeAsset(row) {
  await ElMessageBox.confirm('确定删除资产「' + (row.name || row.key) + '」？', '删除')
  await stStore.remove(row.id)
  ElMessage.success('已删除')
}
async function exportAssets() {
  const lines = stStore.list.map(a =>
    [a.name, a.key, a.access_key, a.secret_key, a.region, a.endpoint, a.domain, a.notes || ''].join(',')
  )
  const text = 'name,key,ak,sk,region,endpoint,domain,notes\n' + lines.join('\n')
  try { await navigator.clipboard.writeText(text) } catch {}
  if (window.akSync?.exportUrls) {
    await window.akSync.exportUrls({ name: 'storage-assets.csv', urls: text.split('\n') })
  }
  ElMessage.success('资产已导出')
}
function displayName(row) {
  const p = prefix.value
  let n = row.name || ''
  if (p && n.startsWith(p)) n = n.slice(p.length)
  return n.replace(/\/$/, '') || row.name
}
function crumbPath(i) { return crumbs.value.slice(0, i + 1).join('/') + '/' }
function rowAk() {
  if (savedId.value) {
    const s = stStore.list.find(x => x.id === savedId.value)
    if (s) return s
  }
  const v = store.list.find(x => x.id === akId.value)
  if (v) return v
  if (manual.ak && manual.sk) return { access_key: manual.ak, secret_key: manual.sk }
  return null
}
function s3Opts() {
  return {
    region: region.value,
    endpoint: needsEndpoint.value ? endpoint.value : undefined,
    forcePathStyle: ['minio', 'ks3', 'jd'].includes(current.value.key)
  }
}
function open(p) {
  current.value = p
  buckets.value = []; objects.value = []; prefixes.value = []
  bucket.value = ''; prefix.value = ''; selected.value = []; lastUrl.value = ''
  pageInfo.nextMarker = null; pageInfo.isTruncated = false
  opts.customDomain = hasFeature('customDomain')
  opts.paging = hasFeature('paging')
  opts.manualPrivateBucket = hasFeature('manualPrivateBucket')
  if (p.key === 'aliyun') region.value = 'oss-cn-hangzhou'
  if (p.key === 'aws') { region.value = 'us-east-1'; endpoint.value = '' }
  if (p.key === 'minio') { region.value = 'us-east-1'; endpoint.value = 'http://127.0.0.1:9000' }
  if (p.key === 'ks3') { region.value = 'BEIJING'; endpoint.value = 'https://ks3-cn-beijing.ksyun.com' }
  if (p.key === 'jd') { region.value = 'cn-north-1'; endpoint.value = 'https://s3.cn-north-1.jdcloud-oss.com' }
}
function onSavedPick() {
  const s = stStore.list.find(x => x.id === savedId.value)
  if (!s) return
  if (s.region) region.value = s.region
  if (s.endpoint) endpoint.value = s.endpoint
  if (s.domain) domain.value = s.domain
}
function useSaved(a) {
  const p = providers.find(x => x.key === a.key)
  if (p) open(p)
  savedId.value = a.id
  onSavedPick()
}

async function loadBuckets() {
  const row = rowAk()
  if (!row && current.value.key !== 'upyun') return ElMessage.error('请填写 AK')
  loading.value = true
  try {
    const k = current.value.key
    if (k === 'upyun') {
      const svc = (row && row.service_name && row.service_name !== '-' ? row.service_name : '') || upyun.service
      if (!svc) return ElMessage.error('请填写又拍云服务名')
      upyun.service = svc
      if (row) {
        upyun.operator = row.access_key || upyun.operator
        upyun.password = row.secret_key || upyun.password
      }
      buckets.value = [{ name: svc, region: '-' }]
    } else if (k === 'aliyun') {
      const res = await ossBuckets(row, region.value)
      buckets.value = (res.buckets || []).map(b => ({ name: b.name, region: b.region }))
    } else if (k === 'tencent') {
      const res = await cosBuckets(row)
      buckets.value = (res.Buckets || []).map(b => ({ name: b.Name, region: b.Location }))
    } else if (k === 'qiniu') {
      buckets.value = ((await qiniuBuckets(row)).buckets || []).map(b => ({ name: b.name, region: '-' }))
    } else if (k === 'qingstor') {
      buckets.value = (await qingstorBuckets(row)).buckets || []
    } else if (S3.has(k)) {
      buckets.value = (await s3Buckets(row, s3Opts())).buckets || []
    }
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

function onBucket(row) {
  bucket.value = row.name
  if (current.value.key === 'aliyun' && row.region) {
    region.value = row.region.startsWith('oss-') ? row.region : ('oss-' + row.region)
  }
  if (current.value.key === 'tencent' && row.region) cosRegion.value = row.region
  if (current.value.key === 'qingstor' && row.region) qingZone.value = row.region
  prefix.value = ''
  reloadObjects()
}
function goPrefix(p) { prefix.value = p; reloadObjects() }
function enterDir(row) { prefix.value = row.name; reloadObjects() }
function onRowDbl(row) {
  if (row.isDir) enterDir(row)
  else if (isImage(row.name) || canSign.value) doPreview(row)
}

async function reloadObjects(append = false) {
  const row = rowAk()
  if (!row || !bucket.value) return
  loading.value = true
  try {
    if (!append) {
      objects.value = []
      prefixes.value = []
      pageInfo.nextMarker = null
    }
    const k = current.value.key
    const pageSize = opts.paging ? 100 : 1000
    let res
    const delimiter = '/'
    if (k === 'upyun') {
      const dir = prefix.value ? ('/' + prefix.value.replace(/^\/+|\/+$/g, '') + '/') : '/'
      upyun.path = dir
      const listed = await upyunObjects({
        service: upyun.service || bucket.value,
        operator: (row && row.access_key) || upyun.operator,
        password: (row && row.secret_key) || upyun.password,
        path: dir
      })
      const pref = prefix.value || ''
      const objs = []
      const prefs = []
      for (const f of (listed.objects || [])) {
        const base = String(f.name || '').replace(/^\/+/, '')
        const full = pref + base + (f.type === 'F' ? '/' : '')
        if (f.type === 'F') prefs.push({ name: full, size: '-', lastModified: '', isDir: true })
        else objs.push({ name: pref + base, size: f.size, lastModified: f.lastModified, isDir: false })
      }
      res = { objects: objs, prefixes: prefs, nextMarker: null, isTruncated: false }
    } else if (k === 'aliyun') {
      res = await ossObjects(row, {
        region: region.value, bucket: bucket.value, prefix: prefix.value,
        marker: append ? pageInfo.nextMarker : undefined, maxKeys: pageSize, delimiter
      })
    } else if (k === 'tencent') {
      res = await cosObjects(row, {
        Bucket: bucket.value, Region: cosRegion.value, Prefix: prefix.value,
        Marker: append ? pageInfo.nextMarker : undefined, MaxKeys: pageSize, Delimiter: delimiter
      })
    } else if (k === 'qiniu') {
      res = await qiniuObjects(row, {
        bucket: bucket.value, prefix: prefix.value,
        marker: append ? pageInfo.nextMarker : undefined, limit: pageSize
      })
    } else if (k === 'qingstor') {
      res = await qingstorObjects(row, { bucket: bucket.value, zone: qingZone.value, prefix: prefix.value })
      res = {
        objects: (res.objects || []).map(o => ({ ...o, isDir: false })),
        prefixes: [], nextMarker: null, isTruncated: false
      }
    } else {
      res = await s3Objects(row, {
        ...s3Opts(), bucket: bucket.value, prefix: prefix.value,
        continuationToken: append ? pageInfo.nextMarker : undefined,
        maxKeys: pageSize, delimiter
      })
    }
    // normalize legacy shapes
    let objs = res.objects || res.Contents || []
    if (res.Contents) objs = res.Contents.map(o => ({ name: o.Key, size: o.Size, lastModified: o.LastModified, isDir: false }))
    const prefs = res.prefixes || []
    if (append) {
      objects.value.push(...objs)
      prefixes.value.push(...prefs)
    } else {
      objects.value = objs
      prefixes.value = prefs
    }
    pageInfo.nextMarker = res.nextMarker
    pageInfo.isTruncated = !!res.isTruncated
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
  // 缩略图后台加载，不挡住列表展示 / loading 遮罩
  try {
    if (!append) {
      for (const k of Object.keys(thumbMap)) delete thumbMap[k]
    }
    loadThumbs()
  } catch {}
}
function loadMore() { if (pageInfo.isTruncated) reloadObjects(true) }

function upyunCred() {
  const row = rowAk() || {}
  return {
    service: upyun.service || bucket.value || row.service_name,
    operator: row.access_key || upyun.operator,
    password: row.secret_key || upyun.password
  }
}
function putOpts(localPath, key) {
  const k = current.value.key
  const objectKey = key || ((prefix.value || '') + (localPath.split(/[/\\]/).pop()))
  if (k === 'aliyun') return { region: region.value, bucket: bucket.value, key: objectKey, localPath }
  if (k === 'tencent') return { Bucket: bucket.value, Region: cosRegion.value, Key: objectKey, localPath }
  if (k === 'qiniu') return { bucket: bucket.value, key: objectKey, localPath }
  if (k === 'qingstor') return { bucket: bucket.value, zone: qingZone.value, key: objectKey, localPath }
  if (k === 'upyun') {
    return { ...upyunCred(), remotePath: '/' + String(objectKey).replace(/^\//, ''), localPath }
  }
  return { ...s3Opts(), bucket: bucket.value, key: objectKey, localPath }
}
function getOpts(key, localPath) {
  const k = current.value.key
  if (k === 'aliyun') return { region: region.value, bucket: bucket.value, key, localPath }
  if (k === 'tencent') return { Bucket: bucket.value, Region: cosRegion.value, Key: key, localPath }
  if (k === 'qiniu') return { bucket: bucket.value, key, localPath, domain: domain.value }
  if (k === 'qingstor') return { bucket: bucket.value, zone: qingZone.value, key, localPath }
  if (k === 'upyun') return { ...upyunCred(), remotePath: '/' + String(key).replace(/^\//, ''), localPath }
  return { ...s3Opts(), bucket: bucket.value, key, localPath }
}
function delOpts(key) {
  const k = current.value.key
  if (k === 'aliyun') return { region: region.value, bucket: bucket.value, key }
  if (k === 'tencent') return { Bucket: bucket.value, Region: cosRegion.value, Key: key }
  if (k === 'qiniu') return { bucket: bucket.value, key }
  if (k === 'qingstor') return { bucket: bucket.value, zone: qingZone.value, key }
  if (k === 'upyun') return { ...upyunCred(), remotePath: '/' + String(key).replace(/^\//, '') }
  return { ...s3Opts(), bucket: bucket.value, key }
}
function moveOpts(fromKey, toKey) {
  const k = current.value.key
  if (k === 'aliyun') return { region: region.value, bucket: bucket.value, fromKey, toKey }
  if (k === 'tencent') return { Bucket: bucket.value, Region: cosRegion.value, fromKey, toKey }
  if (k === 'qiniu') return { bucket: bucket.value, fromKey, toKey }
  if (k === 'qingstor') return { bucket: bucket.value, zone: qingZone.value, fromKey, toKey }
  if (k === 'upyun') {
    return {
      ...upyunCred(),
      fromKey: '/' + String(fromKey).replace(/^\//, ''),
      toKey: '/' + String(toKey).replace(/^\//, '')
    }
  }
  return { ...s3Opts(), bucket: bucket.value, fromKey, toKey }
}
function mkdirOpts(dir) {
  const k = current.value.key
  const full = (prefix.value || '') + dir
  if (k === 'aliyun') return { region: region.value, bucket: bucket.value, dir: full }
  if (k === 'tencent') return { Bucket: bucket.value, Region: cosRegion.value, dir: full }
  if (k === 'qingstor') return { bucket: bucket.value, zone: qingZone.value, dir: full }
  if (k === 'upyun') return { ...upyunCred(), dir: '/' + String(full).replace(/^\//, '') }
  return { ...s3Opts(), bucket: bucket.value, dir: full }
}
function signOpts(key) {
  const k = current.value.key
  const expires = signExpires.value
  if (k === 'aliyun') return { region: region.value, bucket: bucket.value, key, expires }
  if (k === 'tencent') return { Bucket: bucket.value, Region: cosRegion.value, Key: key, expires }
  if (k === 'qiniu') return { key, domain: domain.value, expires }
  return { ...s3Opts(), bucket: bucket.value, key, expires }
}

function publicUrl(key) {
  if (!domain.value) return ''
  const host = domain.value.replace(/^https?:\/\//, '').replace(/\/$/, '')
  let url = `${opts.https ? 'https' : 'http'}://${host}/${String(key).replace(/^\//, '')}`
  if (opts.imageStyle) url += (url.includes('?') ? '&' : '?') + opts.imageStyle
  return url
}
async function copyText(t, tip) {
  lastUrl.value = t
  try { await navigator.clipboard.writeText(t) } catch {}
  ElMessage.success(tip || '已复制')
}
function copyPath(row) { copyText(row.name, '路径已复制') }
async function resolveUrl(row) {
  const u = publicUrl(row.name)
  if (u && !opts.manualPrivateBucket) return u
  const r = await storageSign(current.value.key, rowAk(), signOpts(row.name))
  return r.url
}
async function copyLink(row) {
  try {
    const u = await resolveUrl(row)
    copyText(u, '链接已复制')
  } catch (e) { ElMessage.error(e.message) }
}
async function copyMd(row) {
  try {
    const u = await resolveUrl(row)
    copyText(`![${displayName(row)}](${u})`, 'Markdown 已复制')
  } catch (e) { ElMessage.error(e.message) }
}
async function copySmart(row) {
  if (opts.copyType === 'markdown') return copyMd(row)
  return copyLink(row)
}

async function confirmDel(msg) {
  if (opts.hideDeleteConfirm) return true
  try { await ElMessageBox.confirm(msg, '确认'); return true } catch { return false }
}
async function ensureOverwrite(key) {
  if (!opts.askOverwrite) return true
  const exists = objects.value.some(o => o.name === key)
  if (!exists) return true
  try {
    await ElMessageBox.confirm('如果文件已存在,是否覆盖上传', '覆盖上传')
    return true
  } catch { return false }
}

async function uploadLocalPath(localPath, relativeKey) {
  const name = relativeKey || localPath.split(/[/\\]/).pop()
  const key = (prefix.value || '') + name
  if (!opts.uploadNoAsk) {
    if (!(await ensureOverwrite(key))) throw new Error('用户取消覆盖')
  }
  await storagePut(current.value.key, rowAk(), putOpts(localPath, key))
  const url = publicUrl(key)
  pushLog({ key, url, ok: true, size: '' })
  return key
}

async function doUpload() {
  if (!window.akDialog) return ElMessage.error('请在 Electron 中运行')
  if (!opts.uploadNoAsk && bucket.value) {
    try {
      await ElMessageBox.confirm(`文件将会被上传至 ${bucket.value} 存储桶下的: ${prefix.value || '/'}`, '确认上传')
    } catch { return }
  }
  const p = await window.akDialog.openFile()
  if (!p) return
  loading.value = true
  try { await uploadLocalPath(p); ElMessage.success('上传成功'); await reloadObjects() }
  catch (e) { ElMessage.error(e.message); pushLog({ key: p, ok: false }) }
  finally { loading.value = false }
}
async function doUploadMulti() {
  if (!window.akDialog?.openFiles) return ElMessage.error('请在 Electron 中运行')
  const ps = await window.akDialog.openFiles()
  if (!ps?.length) return
  loading.value = true
  let ok = 0
  try {
    for (const p of ps) { try { await uploadLocalPath(p); ok++ } catch { pushLog({ key: p, ok: false }) } }
    ElMessage.success(`上传 ${ok}/${ps.length}`); await reloadObjects()
  } finally { loading.value = false }
}
async function doUploadFolder() {
  if (!window.akDialog?.openDirectories) return ElMessage.error('请在 Electron 中运行')
  const dirs = await window.akDialog.openDirectories()
  if (!dirs?.length) return
  loading.value = true
  try {
    const files = await window.akDialog.listFilesRecursive(dirs)
    if (!files.length) return ElMessage.warning('本文件夹下没有要上传的文件')
    let ok = 0
    for (const f of files) {
      try { await uploadLocalPath(f.localPath, f.relativeKey); ok++ }
      catch { pushLog({ key: f.relativeKey, ok: false }) }
    }
    ElMessage.success(`文件夹上传 ${ok}/${files.length}`)
    await reloadObjects()
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function resolveDownloadPath(fileName) {
  if (downloadDir.value && window.akDialog?.pathJoin) {
    await window.akDialog.ensureDir(downloadDir.value)
    return window.akDialog.pathJoin(downloadDir.value, fileName)
  }
  return window.akDialog.saveFile(fileName)
}
async function fileToTemp(file) {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return window.akDialog.writeTemp({ name: file.name, base64: btoa(binary) })
}
async function onDrop(e) {
  dragOver.value = false
  if (!canRW.value || !bucket.value) return
  const files = [...(e.dataTransfer?.files || [])]
  if (!files.length) return
  loading.value = true
  let ok = 0
  try {
    for (const f of files) {
      try { await uploadLocalPath(await fileToTemp(f)); ok++ } catch {}
    }
    ElMessage.success(`拖拽上传 ${ok}/${files.length}`); await reloadObjects()
  } finally { loading.value = false }
}

async function doDownload(obj) {
  const localPath = await resolveDownloadPath(displayName(obj))
  if (!localPath) return
  loading.value = true
  try {
    await storageGet(current.value.key, rowAk(), getOpts(obj.name, localPath))
    ElMessage.success('下载成功：' + localPath)
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function doBatchDownload() {
  if (!selected.value.length) return
  loading.value = true
  let ok = 0
  try {
    for (const o of selected.value) {
      try {
        const localPath = await resolveDownloadPath(displayName(o))
        if (!localPath) continue
        await storageGet(current.value.key, rowAk(), getOpts(o.name, localPath))
        ok++
      } catch {}
    }
    ElMessage.success(`下载结束 ${ok}/${selected.value.length}`)
  } finally { loading.value = false }
}
async function exportUrls() {
  if (!selected.value.length) return
  loading.value = true
  try {
    const lines = []
    for (const o of selected.value) {
      try { lines.push(await resolveUrl(o)) } catch { lines.push(o.name) }
    }
    const text = lines.join('\n')
    lastUrl.value = text
    await copyText(text, `已复制 ${lines.length} 条 URL`)
    if (window.akSync?.exportUrls) {
      await window.akSync.exportUrls({ name: `urls-${bucket.value || 'export'}.txt`, urls: lines })
      ElMessage.success('URL 导出完成')
    }
  } finally { loading.value = false }
}
function cdnFromSelection() {
  cdnUrls.value = selected.value.map(o => publicUrl(o.name) || o.name).join('\n')
  cdnVisible.value = true
}

function onRowContext(row, _col, e) {
  e.preventDefault()
  ctx.row = row
  ctx.x = e.clientX
  ctx.y = e.clientY
  ctx.visible = true
}
async function ctxAction(act) {
  const row = ctx.row
  ctx.visible = false
  if (!row && act !== 'selectAll') return
  if (act === 'detail') {
    detailText.value = JSON.stringify(row, null, 2)
    detailVisible.value = true
  } else if (act === 'preview') doPreview(row)
  else if (act === 'download') doDownload(row)
  else if (act === 'rename') doRename(row)
  else if (act === 'move') doMove(row)
  else if (act === 'copy') copyLink(row)
  else if (act === 'md') copyMd(row)
  else if (act === 'select') {
    tableRef.value?.toggleRowSelection(row, true)
  } else if (act === 'selectAll') selectAllToggle()
  else if (act === 'cdn') {
    selected.value = [row]
    cdnFromSelection()
  } else if (act === 'delete') {
    if (row.isDir) ElMessage.info('请先进入目录后批量删除对象')
    else doDelete(row)
  }
}

function openSync() {
  if (!bucket.value) return
  syncPlan.value = null
  syncLocalDir.value = ''
  syncMode.value = 0
  syncVisible.value = true
}

async function listAllCloudFiles() {
  const row = rowAk()
  const all = []
  let marker = null
  let truncated = true
  let guard = 0
  while (truncated && guard++ < 200) {
    const k = current.value.key
    let res
    if (k === 'aliyun') {
      res = await ossObjects(row, {
        region: region.value, bucket: bucket.value, prefix: prefix.value || '',
        marker: marker || undefined, maxKeys: 1000
      })
    } else if (k === 'tencent') {
      res = await cosObjects(row, {
        Bucket: bucket.value, Region: cosRegion.value, Prefix: prefix.value || '',
        Marker: marker || undefined, MaxKeys: 1000
      })
    } else if (k === 'qiniu') {
      res = await qiniuObjects(row, {
        bucket: bucket.value, prefix: prefix.value || '',
        marker: marker || undefined, limit: 1000
      })
    } else if (S3.has(k)) {
      res = await s3Objects(row, {
        ...s3Opts(), bucket: bucket.value, prefix: prefix.value || '',
        continuationToken: marker || undefined, maxKeys: 1000
      })
    } else {
      res = { objects: objects.value, nextMarker: null, isTruncated: false }
    }
    const objs = res.objects || []
    for (const o of objs) {
      if (o.isDir) continue
      all.push({
        key: o.name,
        size: o.size,
        lastModified: o.lastModified,
        ETag: o.etag || o.ETag || o.hash || ''
      })
    }
    marker = res.nextMarker
    truncated = !!res.isTruncated
    if (!marker) truncated = false
  }
  return all
}

async function prepareSync() {
  if (!window.akSync?.plan || !window.akDialog?.openDirectory) {
    return ElMessage.error('请在 Electron 中运行')
  }
  const dir = await window.akDialog.openDirectory()
  if (!dir) return
  syncLocalDir.value = dir
  loading.value = true
  try {
    const pref = prefix.value || ''
    const cloudFiles = (await listAllCloudFiles()).map(f => ({
      ...f,
      // 规划时用相对当前前缀的 key，与本地相对路径对齐
      key: pref && f.key.startsWith(pref) ? f.key.slice(pref.length) : f.key,
      _fullKey: f.key
    }))
    syncPlan.value = await window.akSync.plan({
      localDir: dir,
      cloudFiles,
      mergeType: syncMode.value
    })
    // 还原删除用的完整 key
    const fullMap = new Map(cloudFiles.map(c => [c.key, c._fullKey]))
    for (const d of syncPlan.value.deletes || []) {
      d.key = fullMap.get(d.key) || (pref + d.key)
    }
    for (const d of syncPlan.value.downloads || []) {
      d.key = fullMap.get(d.key) || (pref + d.key)
    }
    ElMessage.success('同步规划完成')
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function runSync() {
  if (!syncPlan.value) return
  loading.value = true
  const plan = syncPlan.value
  const pref = prefix.value || ''
  let up = 0, down = 0, del = 0
  try {
    for (const u of plan.uploads || []) {
      try {
        await storagePut(current.value.key, rowAk(), putOpts(u.path, pref + u.key))
        up++
      } catch {}
    }
    for (const d of plan.downloads || []) {
      try {
        const parent = d.localPath.replace(/[/\\][^/\\]+$/, '')
        await window.akDialog.ensureDir(parent)
        await storageGet(current.value.key, rowAk(), getOpts(d.key, d.localPath))
        down++
      } catch {}
    }
    for (const d of plan.deletes || []) {
      try {
        await storageDelete(current.value.key, rowAk(), delOpts(d.key))
        del++
      } catch {}
    }
    if (plan.localDeletes?.length) {
      await window.akSync.applyLocalDeletes(plan.localDeletes)
    }
    ElMessage.success(`同步完成 上传${up} 下载${down} 删云${del}`)
    syncVisible.value = false
    await reloadObjects()
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function doDelete(obj) {
  if (opts.hideDeleteBtn) return
  if (!(await confirmDel('确认删除文件 ' + obj.name + '？'))) return
  loading.value = true
  try {
    await storageDelete(current.value.key, rowAk(), delOpts(obj.name))
    ElMessage.success('删除成功'); await reloadObjects()
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function doBatchDelete() {
  if (opts.hideDeleteBtn) return
  if (!(await confirmDel(`确认删除选中的 ${selected.value.length} 个文件？`))) return
  loading.value = true
  try {
    for (const o of selected.value) {
      try { await storageDelete(current.value.key, rowAk(), delOpts(o.name)) } catch {}
    }
    ElMessage.success('批量删除完成'); await reloadObjects()
  } finally { loading.value = false }
}
async function doMkdir() {
  const { value } = await ElMessageBox.prompt('目录名', '创建目录').catch(() => ({}))
  if (!value) return
  loading.value = true
  try {
    await storageMkdir(current.value.key, rowAk(), mkdirOpts(value))
    ElMessage.success('创建目录成功'); await reloadObjects()
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function doMove(obj) {
  const { value } = await ElMessageBox.prompt('目标 Key', '移动', { inputValue: obj.name }).catch(() => ({}))
  if (!value || value === obj.name) return
  loading.value = true
  try {
    await storageMove(current.value.key, rowAk(), moveOpts(obj.name, value))
    ElMessage.success('文件移动成功'); await reloadObjects()
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function doRename(obj) {
  const base = displayName(obj)
  const { value } = await ElMessageBox.prompt('新文件名', '重命名', { inputValue: base }).catch(() => ({}))
  if (!value || value === base) return
  const toKey = (prefix.value || '') + value
  loading.value = true
  try {
    await storageMove(current.value.key, rowAk(), moveOpts(obj.name, toKey))
    ElMessage.success('文件修改成功'); await reloadObjects()
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function doSign(obj) {
  loading.value = true
  try {
    const r = await storageSign(current.value.key, rowAk(), signOpts(obj.name))
    copyText(r.url, '预签名链接已复制')
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
async function doPreview(obj) {
  loading.value = true
  try {
    const u = publicUrl(obj.name)
    if (u && !opts.manualPrivateBucket) {
      previewUrl.value = u
    } else {
      const r = await storageSign(current.value.key, rowAk(), signOpts(obj.name))
      previewUrl.value = r.url
    }
    previewVisible.value = true
  } catch (e) { ElMessage.error('预览失败：' + e.message) }
  finally { loading.value = false }
}
function selectAllToggle() {
  const files = filteredRows.value.filter(r => !r.isDir)
  if (layoutMode.value === 'grid') {
    if (selected.value.length) selected.value = []
    else selected.value = [...files]
    return
  }
  const t = tableRef.value
  if (!t) return
  if (selected.value.length) t.clearSelection()
  else files.forEach(r => t.toggleRowSelection(r, true))
}

async function doRefreshCdn() {
  loading.value = true
  try {
    const r = await qiniuRefreshCdn(rowAk(), cdnUrls.value)
    ElMessage.success('刷新成功'); lastUrl.value = JSON.stringify(r); cdnVisible.value = false
  } catch (e) { ElMessage.error('刷新失败：' + e.message) }
  finally { loading.value = false }
}
async function doUrlUpload() {
  if (!urlUploadSrc.value) return ElMessage.error('请输入你要上传的文件链接')
  loading.value = true
  try {
    const res = await fetch(urlUploadSrc.value)
    const buf = await res.arrayBuffer()
    const name = decodeURIComponent(urlUploadSrc.value.split('?')[0].split('/').pop() || 'remote.bin')
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    const localPath = await window.akDialog.writeTemp({ name, base64: btoa(binary) })
    await uploadLocalPath(localPath)
    ElMessage.success('直传成功')
    urlDlgVisible.value = false
    await reloadObjects()
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

function openSaveAcc() {
  Object.assign(accForm, {
    id: null,
    name: '', key: current.value?.key || 'aliyun',
    access_key: manual.ak, secret_key: manual.sk,
    region: region.value, endpoint: endpoint.value, domain: domain.value, notes: ''
  })
  accVisible.value = true
}
async function saveAcc() {
  if (!accForm.access_key || !accForm.secret_key) return ElMessage.error('请填写 AK/SK')
  try {
    if (accForm.id) {
      await stStore.update({ ...accForm })
      ElMessage.success('已更新并持久化')
    } else {
      await stStore.add({ ...accForm })
      ElMessage.success('已保存到本地（重启仍保留）')
    }
    accVisible.value = false
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}
async function saveCurrentAcc() {
  const row = rowAk()
  if (!row) return ElMessage.error('无 AK')
  await stStore.add({
    name: (current.value?.name || '') + '-' + row.access_key.slice(0, 6),
    key: current.value.key,
    access_key: row.access_key, secret_key: row.secret_key,
    region: region.value, endpoint: endpoint.value, domain: domain.value
  })
  ElMessage.success('已保存')
}
</script>

<style scoped>
.storage-root { min-height: calc(100vh - 100px); }

/* —— 资产列表（精密运维台） —— */
.assets-page {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 0 0 12px;
  min-height: calc(100vh - 108px);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.assets-subnav {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #fafbfd, #f5f7fb);
}
.subnav-item {
  border: 0; background: transparent; padding: 13px 14px;
  font-size: 13px; color: var(--text); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  white-space: nowrap;
  transition: color .15s, border-color .15s, background .15s;
}
.subnav-item:hover { color: var(--accent); }
.subnav-item.on {
  color: var(--accent-active);
  border-bottom-color: var(--accent);
  font-weight: 650;
  background: #fff;
}
.assets-list-pane { padding: 0 0 12px; background: #fff; }
.assets-toolbar {
  display: flex; gap: 8px; align-items: center; justify-content: flex-end;
  padding: 14px 16px 10px;
}
.asset-name {
  font-size: 13px; color: var(--title); font-weight: 550;
  display: inline-flex; align-items: center; gap: 6px;
}
.assets-form-pane {
  padding: 28px 40px 40px;
  max-width: 720px;
}
.form-title {
  margin: 0 0 22px;
  font-size: 18px;
  font-weight: 650;
  color: var(--title);
  letter-spacing: 0.02em;
}
.cred-form :deep(.el-form-item__label) { color: #515a6e; }
.help-ico {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; margin-left: 12px;
  border-radius: 50%; background: #c5c8ce; color: #fff;
  font-size: 11px; cursor: help; vertical-align: middle;
}
.cred-hint {
  margin: 8px 0 0 130px;
  font-size: 12px; color: var(--muted);
}
.cred-hint a { color: var(--accent); text-decoration: none; }
.cred-hint a:hover { text-decoration: underline; }

/* —— 浏览器 —— */
.storage-page {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
  height: calc(100vh - 100px);
  min-height: 520px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}
.browser-side {
  background: linear-gradient(180deg, #f4f7fb 0%, #eef2f7 100%);
  border-right: 1px solid var(--line);
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.side-account {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 12px 12px;
  border: 0;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  background: rgba(255,255,255,0.75);
  transition: background .15s;
}
.side-account:hover { background: #fff; }
.acc-mark {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(145deg, #4aa3f5, #1f6fd1);
  color: #fff; font-size: 14px; flex-shrink: 0;
}
.acc-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.acc-text strong {
  font-size: 13px; color: var(--title); font-weight: 650;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acc-text small { color: var(--muted); font-size: 11px; }
.side-hd {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; color: var(--muted); font-weight: 650;
  letter-spacing: 0.04em;
  padding: 12px 14px 6px;
}
.side-mini {
  border: 0; background: transparent; color: var(--muted);
  cursor: pointer; font-size: 14px; line-height: 1; padding: 2px 4px;
  border-radius: 4px;
}
.side-mini:hover { color: var(--accent); background: #e8f3ff; }
.bucket-list { flex: 1; overflow: auto; padding: 0 8px 8px; }
.bucket-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  border-radius: 8px;
  text-align: left;
  margin-bottom: 2px;
  transition: background .12s, color .12s;
}
.bucket-item:hover { background: rgba(45, 140, 240, 0.08); color: var(--accent-active); }
.bucket-item.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 10px rgba(45, 140, 240, 0.28);
}
.b-ico { font-size: 12px; opacity: 0.85; flex-shrink: 0; }
.b-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-empty { padding: 16px 8px; font-size: 12px; color: var(--muted); line-height: 1.5; }
.side-foot {
  display: flex; border-top: 1px solid var(--line);
  background: rgba(255,255,255,0.8);
}
.side-foot button {
  flex: 1; border: 0; background: transparent;
  padding: 11px 4px; font-size: 12px; color: var(--muted); cursor: pointer;
  font-weight: 500;
}
.side-foot button:hover { color: var(--accent); background: #f0f7ff; }

.main {
  background: #fff;
  padding: 12px 16px 14px;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.main-hd {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.hd-title-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.main-hd h2 {
  margin: 0;
  font-size: 16px;
  color: var(--title);
  font-weight: 650;
  letter-spacing: 0.01em;
  max-width: 420px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hd-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.hd-actions :deep(.el-button) { margin-left: 0 !important; }
.sub { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.empty-logs { color: var(--muted); padding: 24px; text-align:center; }
.log-item {
  display:grid; grid-template-columns: 1fr auto; gap:4px 12px;
  padding:10px 0; border-bottom:1px solid var(--line);
}
.log-key { font-family: var(--mono); font-size:12px; word-break:break-all; grid-column:1/-1; }
.log-meta { font-size:12px; color: var(--muted); }
.log-btns { text-align:right; }
.cred { margin-bottom: 8px; }
.obj-pane.full {
  border: 0;
  padding: 0;
  background: transparent;
  flex: 1 1 auto;
  min-height: 240px;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.obj-pane.drag { outline: 2px dashed var(--accent); background: #f0faff; border-radius: 8px; }
.crumb-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px; gap: 12px;
  flex-shrink: 0;
}
.crumb-row :deep(.el-breadcrumb) { font-size: 13px; }
.crumb-row a { color: var(--accent); text-decoration: none; }
.search-inp { width: 200px; flex-shrink: 0; }

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 8px 10px;
  background: #f7f9fc;
  border: 1px solid var(--line);
  border-radius: 10px;
  flex-shrink: 0;
}
.tb-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.tb-group :deep(.el-button) { margin-left: 0 !important; }
.tb-sep {
  width: 1px;
  height: 22px;
  background: var(--line-strong);
  flex-shrink: 0;
}
.tb-grow { flex: 1; min-width: 4px; }
.tb-hint {
  font-size: 12px;
  color: var(--accent-active);
  font-weight: 550;
  padding: 0 4px;
}

.name { cursor: default; color: var(--text); }
.name.dir { color: var(--accent); cursor: pointer; font-weight: 600; }
.urlbox { margin-top: 8px; }
.sync-modes { display:flex; flex-direction:column; align-items:flex-start; gap:10px; }
.sync-stats { margin-top:12px; font-size:12px; color: var(--muted); }
.detail { background:#f8f8f9; border:1px solid var(--line); padding:12px; max-height:50vh; overflow:auto; font-size:12px; }

/* 网格缩略图 */
.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 12px;
  padding: 4px 2px 20px;
  flex: 1 1 auto;
  min-height: 200px;
  width: 100%;
  overflow: auto;
  align-content: start;
  align-items: start;
}
.grid-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px;
  cursor: pointer;
  text-align: center;
  background: #fff;
  align-self: start;
  width: 100%;
  max-width: 160px;
  transition: border-color .15s, background .15s, box-shadow .15s, transform .15s;
}
.grid-card:hover {
  background: #f8fbff;
  border-color: #c5dcfa;
  box-shadow: 0 4px 12px rgba(45, 140, 240, 0.08);
}
.grid-card.selected {
  border-color: var(--accent);
  background: #eef6ff;
  box-shadow: 0 0 0 2px rgba(45, 140, 240, 0.18);
}
.thumb {
  width: 100%;
  aspect-ratio: 1 / 1;
  height: auto;
  max-height: 140px;
  background: linear-gradient(160deg, #f3f5f8, #e9eef5);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.folder-ico { font-size: 42px; line-height: 1; opacity: 0.9; }
.file-ico {
  width: 52px; height: 60px;
  background: #fff; border: 1px solid #d5dbe6; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #4a5568;
  letter-spacing: 0.02em;
  box-shadow: 0 1px 3px rgba(20,28,44,.06);
}
.thumb-loading { font-size: 12px; color: var(--muted); }
.gname {
  margin-top: 8px; font-size: 12px; color: var(--title); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.grid-empty {
  grid-column: 1 / -1; text-align: center; padding: 56px 24px;
  color: var(--muted); font-size: 13px;
}
.list-thumb {
  width: 40px; height: 40px; object-fit: cover; border-radius: 6px;
  vertical-align: middle; border: 1px solid var(--line);
}
.ext-mini { font-size: 11px; color: var(--muted); font-weight: 600; }

.ctx-menu {
  position: fixed; z-index: 4000; margin:0; padding: 6px 0;
  list-style: none; background: #fff; border: 1px solid var(--line);
  border-radius: 10px; box-shadow: 0 8px 28px rgba(20,28,44,.14); min-width: 168px;
}
.ctx-menu li {
  padding: 8px 14px; font-size: 13px; cursor: pointer; color: var(--text);
}
.ctx-menu li:hover { background: #eef6ff; color: var(--accent-active); }
.ctx-menu li.danger { color: var(--danger); }
.ctx-menu li.danger:hover { background: #fff1f0; }
</style>
