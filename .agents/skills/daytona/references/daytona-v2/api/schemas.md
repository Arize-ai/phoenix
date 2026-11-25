# Daytona API Schemas

## Contents

- [AcceptInvitationRequest](#acceptinvitationrequest)
- [AcceptPrivacyPolicyRequest](#acceptprivacypolicyrequest)
- [AddProjectMembersRequest](#addprojectmembersrequest)
- [AddProjectServiceAccountRequest](#addprojectserviceaccountrequest)
- [AsyncOperation](#asyncoperation)
- [AuditActionList](#auditactionlist)
- [AuditConfig](#auditconfig)
- [AuditLogPage](#auditlogpage)
- [AutomaticTopUp](#automatictopup)
- [BalanceNotification](#balancenotification)
- [BalancePage](#balancepage)
- [BillingContact](#billingcontact)
- [BillingPlan](#billingplan)
- [BillingProfile](#billingprofile)
- [BillingSession](#billingsession)
- [BucketOptions](#bucketoptions)
- [BuildContextUpload](#buildcontextupload)
- [BuildLogsUrl](#buildlogsurl)
- [ChangeImpact](#changeimpact)
- [ChargePage](#chargepage)
- [ChargeReceiptPdf](#chargereceiptpdf)
- [CompleteBuildContextUploadRequest](#completebuildcontextuploadrequest)
- [Config](#config)
- [CouponRedemption](#couponredemption)
- [CpuCatalog](#cpucatalog)
- [CreateBuildContextUploadRequest](#createbuildcontextuploadrequest)
- [CreateImageMultipartRequest](#createimagemultipartrequest)
- [CreateImageRequest](#createimagerequest)
- [CreateInvitationRequest](#createinvitationrequest)
- [CreateMacosSandboxRequest](#createmacossandboxrequest)
- [CreateOrganizationApiKeyRequest](#createorganizationapikeyrequest)
- [CreateOrganizationRegionRequest](#createorganizationregionrequest)
- [CreateOrganizationRequest](#createorganizationrequest)
- [CreateOrganizationRoleRequest](#createorganizationrolerequest)
- [CreateProjectApiKeyRequest](#createprojectapikeyrequest)
- [CreateProjectRequest](#createprojectrequest)
- [CreateRegionProxyTokenRequest](#createregionproxytokenrequest)
- [CreateRegionRegistrationTokenRequest](#createregionregistrationtokenrequest)
- [CreateReservationRequest](#createreservationrequest)
- [CreateReservationsBulkRequest](#createreservationsbulkrequest)
- [CreateSandboxFromSnapshotRequest](#createsandboxfromsnapshotrequest)
- [CreateSandboxImageRequest](#createsandboximagerequest)
- [CreateSandboxRequest](#createsandboxrequest)
- [CreateSandboxSignedPreviewUrlRequest](#createsandboxsignedpreviewurlrequest)
- [CreateSandboxSnapshotRequest](#createsandboxsnapshotrequest)
- [CreateServiceAccountRequest](#createserviceaccountrequest)
- [CreateSsoSetupLinkRequest](#createssosetuplinkrequest)
- [CreateTopUpSessionRequest](#createtopupsessionrequest)
- [CreateV0SandboxImportRequest](#createv0sandboximportrequest)
- [CreateVolumeRequest](#createvolumerequest)
- [DeclineInvitationRequest](#declineinvitationrequest)
- [Entitlements](#entitlements)
- [ErrorBody](#errorbody)
- [ExchangeTokenRequest](#exchangetokenrequest)
- [ForkSandboxOperation](#forksandboxoperation)
- [ForkSandboxRequest](#forksandboxrequest)
- [Health](#health)
- [Image](#image)
- [ImageConversion](#imageconversion)
- [ImageOrigin](#imageorigin)
- [ImagePage](#imagepage)
- [ImagePlatformFilter](#imageplatformfilter)
- [ImageSearchClass](#imagesearchclass)
- [ImageSearchPage](#imagesearchpage)
- [ImageSearchSort](#imagesearchsort)
- [ImageStatus](#imagestatus)
- [InvitationLookup](#invitationlookup)
- [InvitationPage](#invitationpage)
- [InvitationWithToken](#invitationwithtoken)
- [InvoicePage](#invoicepage)
- [InvoicePdf](#invoicepdf)
- [LifecycleAction](#lifecycleaction)
- [LookupInvitationRequest](#lookupinvitationrequest)
- [MacCatalog](#maccatalog)
- [MacModelList](#macmodellist)
- [MacReservation](#macreservation)
- [MacReservationBatch](#macreservationbatch)
- [MacosSettings](#macossettings)
- [MemberRemovalPreview](#memberremovalpreview)
- [MintSandboxAccessTokenRequest](#mintsandboxaccesstokenrequest)
- [Msa](#msa)
- [NetworkPolicy](#networkpolicy)
- [Organization](#organization)
- [OrganizationApiKey](#organizationapikey)
- [OrganizationApiKeyPage](#organizationapikeypage)
- [OrganizationApiKeyWithToken](#organizationapikeywithtoken)
- [OrganizationFeatureFlags](#organizationfeatureflags)
- [OrganizationLimits](#organizationlimits)
- [OrganizationMember](#organizationmember)
- [OrganizationMemberPage](#organizationmemberpage)
- [OrganizationPage](#organizationpage)
- [OrganizationRegion](#organizationregion)
- [OrganizationRegionPage](#organizationregionpage)
- [OrganizationRole](#organizationrole)
- [OrganizationRoleList](#organizationrolelist)
- [OrganizationRoleUpdate](#organizationroleupdate)
- [OrganizationRunner](#organizationrunner)
- [OrganizationRunnerPage](#organizationrunnerpage)
- [OrganizationServiceAccount](#organizationserviceaccount)
- [OrganizationServiceAccountPage](#organizationserviceaccountpage)
- [OtelConfig](#otelconfig)
- [ParentRegionList](#parentregionlist)
- [PaymentMethodPage](#paymentmethodpage)
- [PermissionList](#permissionlist)
- [PlanList](#planlist)
- [PlanName](#planname)
- [PortMapping](#portmapping)
- [PortalIntent](#portalintent)
- [PreviewMemberUpdateRequest](#previewmemberupdaterequest)
- [PreviewOrganizationRoleUpdateRequest](#previeworganizationroleupdaterequest)
- [PreviewServiceAccountUpdateRequest](#previewserviceaccountupdaterequest)
- [PreviewUrl](#previewurl)
- [PreviewWarning](#previewwarning)
- [PrivacyPolicyStatus](#privacypolicystatus)
- [Project](#project)
- [ProjectApiKey](#projectapikey)
- [ProjectApiKeyPage](#projectapikeypage)
- [ProjectApiKeyWithContext](#projectapikeywithcontext)
- [ProjectApiKeyWithToken](#projectapikeywithtoken)
- [ProjectBudget](#projectbudget)
- [ProjectLifecyclePolicy](#projectlifecyclepolicy)
- [ProjectLimits](#projectlimits)
- [ProjectMemberList](#projectmemberlist)
- [ProjectMemberPage](#projectmemberpage)
- [ProjectPage](#projectpage)
- [ProjectServiceAccountList](#projectserviceaccountlist)
- [ProjectServiceAccountPage](#projectserviceaccountpage)
- [PublicImageSource](#publicimagesource)
- [RedeemCouponRequest](#redeemcouponrequest)
- [RegionInstallation](#regioninstallation)
- [RegionList](#regionlist)
- [RegionMultiplierList](#regionmultiplierlist)
- [RegionProxyTokenPage](#regionproxytokenpage)
- [RegionProxyTokenWithToken](#regionproxytokenwithtoken)
- [RegistrationTokenPage](#registrationtokenpage)
- [RegistrationTokenWithToken](#registrationtokenwithtoken)
- [Registry](#registry)
- [RegistryPage](#registrypage)
- [ReservationPage](#reservationpage)
- [RoleChangeImpact](#rolechangeimpact)
- [RoleList](#rolelist)
- [RotateRegionProxyTokenRequest](#rotateregionproxytokenrequest)
- [Sandbox](#sandbox)
- [SandboxAccessToken](#sandboxaccesstoken)
- [SandboxClass](#sandboxclass)
- [SandboxCreateOperation](#sandboxcreateoperation)
- [SandboxEventTicket](#sandboxeventticket)
- [SandboxLabels](#sandboxlabels)
- [SandboxLifecyclePolicy](#sandboxlifecyclepolicy)
- [SandboxList](#sandboxlist)
- [SandboxPage](#sandboxpage)
- [SandboxPort](#sandboxport)
- [SandboxPortPage](#sandboxportpage)
- [SandboxSearchPage](#sandboxsearchpage)
- [SandboxSearchSort](#sandboxsearchsort)
- [SandboxSecrets](#sandboxsecrets)
- [SandboxStatus](#sandboxstatus)
- [SandboxUsage](#sandboxusage)
- [SandboxUsageHistory](#sandboxusagehistory)
- [Secret](#secret)
- [SecretPage](#secretpage)
- [SetAutomaticTopUpRequest](#setautomatictopuprequest)
- [SetBalanceNotificationRequest](#setbalancenotificationrequest)
- [SetBillingContactRequest](#setbillingcontactrequest)
- [SetOtelConfigRequest](#setotelconfigrequest)
- [SetPlanRequest](#setplanrequest)
- [SetProjectBudgetRequest](#setprojectbudgetrequest)
- [SetRegistryRequest](#setregistryrequest)
- [SetSandboxLabelsRequest](#setsandboxlabelsrequest)
- [SetSandboxNetworkPolicyRequest](#setsandboxnetworkpolicyrequest)
- [SetSandboxPortRequest](#setsandboxportrequest)
- [SetSandboxSecretsRequest](#setsandboxsecretsrequest)
- [SetSecretRequest](#setsecretrequest)
- [SignSandboxFileUrlRequest](#signsandboxfileurlrequest)
- [SignedFileUrl](#signedfileurl)
- [SignedPreviewUrl](#signedpreviewurl)
- [Snapshot](#snapshot)
- [SnapshotKind](#snapshotkind)
- [SnapshotPage](#snapshotpage)
- [SnapshotSearchClass](#snapshotsearchclass)
- [SnapshotSearchPage](#snapshotsearchpage)
- [SnapshotSearchSort](#snapshotsearchsort)
- [SnapshotStatus](#snapshotstatus)
- [SortOrder](#sortorder)
- [SsoConnectionPage](#ssoconnectionpage)
- [SsoSetupLink](#ssosetuplink)
- [TokenExchange](#tokenexchange)
- [UpdateAuditConfigRequest](#updateauditconfigrequest)
- [UpdateEphemeralLifecycleDefaults](#updateephemerallifecycledefaults)
- [UpdateImageRequest](#updateimagerequest)
- [UpdateMacosSettingsRequest](#updatemacossettingsrequest)
- [UpdateMemberRequest](#updatememberrequest)
- [UpdateOrganizationRegionRequest](#updateorganizationregionrequest)
- [UpdateOrganizationRequest](#updateorganizationrequest)
- [UpdateOrganizationRoleRequest](#updateorganizationrolerequest)
- [UpdatePreviewWarningRequest](#updatepreviewwarningrequest)
- [UpdateProjectApiKeyRequest](#updateprojectapikeyrequest)
- [UpdateProjectLifecyclePolicyRequest](#updateprojectlifecyclepolicyrequest)
- [UpdateProjectLimitsRequest](#updateprojectlimitsrequest)
- [UpdateProjectRequest](#updateprojectrequest)
- [UpdateReservationRequest](#updatereservationrequest)
- [UpdateSandboxLifecyclePolicyRequest](#updatesandboxlifecyclepolicyrequest)
- [UpdateServiceAccountRequest](#updateserviceaccountrequest)
- [UsagePeriodPage](#usageperiodpage)
- [UsageReport](#usagereport)
- [User](#user)
- [V0MigrationSummary](#v0migrationsummary)
- [V0SandboxImport](#v0sandboximport)
- [V0SandboxPage](#v0sandboxpage)
- [Volume](#volume)
- [VolumeMount](#volumemount)
- [VolumePage](#volumepage)
- [VolumeType](#volumetype)
- [Wallet](#wallet)
- [AuditActionGroup](#auditactiongroup)
- [AuditLogEntry](#auditlogentry)
- [Balance](#balance)
- [BillingPeriod](#billingperiod)
- [PendingPlanChange](#pendingplanchange)
- [PlanLimits](#planlimits)
- [BillingAddress](#billingaddress)
- [BillingTaxId](#billingtaxid)
- [BucketCredentials](#bucketcredentials)
- [ExternalBucketOrigin](#externalbucketorigin)
- [BuildContextUploadPart](#buildcontextuploadpart)
- [BuildContextUploadState](#buildcontextuploadstate)
- [Charge](#charge)
- [AnalyticsConfig](#analyticsconfig)
- [OidcPublicConfig](#oidcpublicconfig)
- [SshGatewayConfig](#sshgatewayconfig)
- [CpuArchAvailability](#cpuarchavailability)
- [CpuCatalogRegion](#cpucatalogregion)
- [CpuType](#cputype)
- [ApiErrorCode](#apierrorcode)
- [ImageRetention](#imageretention)
- [ImageSourceValue](#imagesourcevalue)
- [ImportedFrom](#importedfrom)
- [ImageListItem](#imagelistitem)
- [SearchTotalRelation](#searchtotalrelation)
- [Invitation](#invitation)
- [Invoice](#invoice)
- [MacCatalogRegion](#maccatalogregion)
- [MacModel](#macmodel)
- [MacReservationEndReason](#macreservationendreason)
- [MacReservationOrigin](#macreservationorigin)
- [MacReservationStatus](#macreservationstatus)
- [MacResources](#macresources)
- [MsaCommit](#msacommit)
- [MsaDiscount](#msadiscount)
- [NetworkPolicyRules](#networkpolicyrules)
- [ImageBuildLimits](#imagebuildlimits)
- [MemberLimits](#memberlimits)
- [SandboxLimits](#sandboxlimits)
- [SandboxResourceLimits](#sandboxresourcelimits)
- [SandboxTimeoutLimits](#sandboxtimeoutlimits)
- [StorageLimits](#storagelimits)
- [UsageLimit](#usagelimit)
- [OrganizationListItem](#organizationlistitem)
- [RegionStatus](#regionstatus)
- [OrganizationRoleKind](#organizationrolekind)
- [OrganizationRunnerAdminState](#organizationrunneradminstate)
- [OrganizationRunnerStatus](#organizationrunnerstatus)
- [ParentRegion](#parentregion)
- [PaymentMethod](#paymentmethod)
- [Permission](#permission)
- [Plan](#plan)
- [EffectiveLifecyclePolicies](#effectivelifecyclepolicies)
- [ProjectLifecycleDefaults](#projectlifecycledefaults)
- [ProjectSandboxLimits](#projectsandboxlimits)
- [ProjectMember](#projectmember)
- [ProjectServiceAccount](#projectserviceaccount)
- [Region](#region)
- [RegionMultiplier](#regionmultiplier)
- [RegionProxyToken](#regionproxytoken)
- [RegistrationToken](#registrationtoken)
- [RegistryKind](#registrykind)
- [Role](#role)
- [ImageReference](#imagereference)
- [LifecyclePolicy](#lifecyclepolicy)
- [PortAssignment](#portassignment)
- [SnapshotReference](#snapshotreference)
- [SandboxListItem](#sandboxlistitem)
- [SandboxUsageSample](#sandboxusagesample)
- [UsageHistoryResolution](#usagehistoryresolution)
- [UsagePeriod](#usageperiod)
- [SnapshotClass](#snapshotclass)
- [SnapshotListItem](#snapshotlistitem)
- [SsoConnection](#ssoconnection)
- [BillingUsagePeriod](#billingusageperiod)
- [UsageReportEntry](#usagereportentry)
- [UsageReportResolution](#usagereportresolution)
- [V0Sandbox](#v0sandbox)
- [VolumeStatus](#volumestatus)
- [BillingType](#billingtype)
- [BalanceApplicableTo](#balanceapplicableto)
- [BalanceType](#balancetype)
- [BillingTaxIdType](#billingtaxidtype)
- [ChargeStatus](#chargestatus)
- [OidcProvider](#oidcprovider)
- [CpuArchitecture](#cpuarchitecture)
- [InvitationStatus](#invitationstatus)
- [InvoicePaymentStatus](#invoicepaymentstatus)
- [InvoiceStatus](#invoicestatus)
- [InvoiceType](#invoicetype)
- [MacCatalogModel](#maccatalogmodel)
- [MsaCommitType](#msacommittype)
- [MsaStatus](#msastatus)
- [MsaDiscountType](#msadiscounttype)
- [PaymentMethodBrand](#paymentmethodbrand)
- [EffectiveLinuxLifecyclePolicies](#effectivelinuxlifecyclepolicies)
- [EffectiveMacosLifecyclePolicies](#effectivemacoslifecyclepolicies)
- [EphemeralLifecycleDefaults](#ephemerallifecycledefaults)
- [PortProtocol](#portprotocol)
- [UsageCharge](#usagecharge)
- [UsagePeriodStatus](#usageperiodstatus)
- [UsageResources](#usageresources)
- [MacPrice](#macprice)
- [EffectiveLifecyclePolicy](#effectivelifecyclepolicy)
- [TimeoutSource](#timeoutsource)

## AcceptInvitationRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The invitation token. |

## AcceptPrivacyPolicyRequest

The privacy policy version the user was shown and accepts. It must equal
the version the platform requires now, so an acceptance of an older version
is refused rather than recorded as consent to text the user never saw.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | The policy version the user was shown and accepts. |

## AddProjectMembersRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_ids` | array of string (uuid) | Yes | The user IDs. |

## AddProjectServiceAccountRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_account_id` | string (uuid) | Yes | The service account ID. |

## AsyncOperation

An accepted asynchronous operation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The ID of the resource the operation acts on. |
| `status` | string | Yes | The resource's lifecycle status at acceptance. |

## AuditActionList

The supported audit actions, grouped by target type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targets` | array of [AuditActionGroup](#auditactiongroup) | Yes | One entry per target type, sorted by target type. |

## AuditConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `disabled` | boolean | Yes | Whether audit capture is disabled. |

## AuditLogPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audit_logs` | array of [AuditLogEntry](#auditlogentry) | Yes | The audit log entries. |
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` at the end. |

## AutomaticTopUp

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `enabled` | boolean | Yes | Whether automatic top-up is enabled. |
| `target_cents` | integer (int64) \| null | No | The balance targeted by a top-up, in cents, or `null` when unset. |
| `threshold_cents` | integer (int64) \| null | No | The balance that triggers a top-up, in cents, or `null` when unset. |

## BalanceNotification

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `enabled` | boolean | Yes | Whether low-balance notifications are enabled. |
| `threshold_cents` | integer (int64) \| null | No | The notification threshold in cents, or `null` when unset. |

## BalancePage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `balances` | array of [Balance](#balance) | Yes | The balances in this page. |
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |

## BillingContact

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `effective_email` | string \| null | No | The email currently used for billing notices, or `null` when unavailable. |
| `email` | string \| null | No | The configured billing email, or `null` when unset. |

## BillingPlan

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `current_period` | null \| [BillingPeriod](#billingperiod) | No | The current billing period, or `null` when unavailable. |
| `entitlements` | array of string | Yes | The entitlement keys included in the plan. |
| `fee_cents` | integer (int64) | Yes | The recurring plan fee in cents. |
| `limits` | [PlanLimits](#planlimits) | Yes | The plan limits. |
| `monthly_credit_cents` | integer (int64) | Yes | The monthly included credit in cents. |
| `pending` | null \| [PendingPlanChange](#pendingplanchange) | No | The scheduled plan change, or `null` when none is pending. |
| `plan` | [PlanName](#planname) | Yes | The current plan. |
| `self_serve` | boolean | Yes | Whether members can change this plan through the API. |

## BillingProfile

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | [BillingAddress](#billingaddress) | Yes | The billing address. |
| `email` | string | Yes | The billing contact email. |
| `name` | string | Yes | The legal billing name. |
| `phone` | string | Yes | The billing contact phone number. |
| `tax_ids` | array of [BillingTaxId](#billingtaxid) | Yes | The registered tax identifiers. |

## BillingSession

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | When the session expires, or `null` when the provider does not expose an expiry. |
| `url` | string | Yes | The generated session URL. |

## BucketOptions

The customer's own bucket, for a bucket volume with origin `external`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `credentials` | null \| [BucketCredentials](#bucketcredentials) | No | The secret names used to access the bucket. |
| `endpoint` | string \| null | No | Non-AWS S3 endpoint (`http(s)://…`); absent or empty means AWS. |
| `name` | string | Yes | The bucket name. |
| `origin` | null \| [ExternalBucketOrigin](#externalbucketorigin) | No | The bucket origin. Defaults to `external`; managed buckets are requested by omitting this whole object. |
| `path_style` | boolean | No | Whether requests use path-style bucket addressing. Defaults to `false`. |
| `prefix` | string \| null | No | Key prefix the volume is scoped to. A trailing `/` is added if missing. |
| `region` | string \| null | No | The S3 bucket's region. The default bucket region is used when omitted. |

## BuildContextUpload

A build-context upload.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytes` | integer (int64) | Yes | The size of the build-context tar in bytes. |
| `dockerfile` | string | Yes | Path of the Dockerfile within the context. |
| `expires_at` | string (date-time) \| null | No | When a `ready` upload can no longer be used by a build. |
| `id` | string (uuid) | Yes | The upload ID. |
| `part_size` | integer (int64) \| null | No | The size of every part but the last, in bytes. Set while `uploading`. |
| `parts` | array of [BuildContextUploadPart](#buildcontextuploadpart) | Yes | The parts to upload. Empty once the upload is `ready`. |
| `region_id` | string | Yes | The region the upload belongs to. |
| `sha256` | string | Yes | The SHA-256 of the build-context tar. |
| `state` | [BuildContextUploadState](#buildcontextuploadstate) | Yes | `uploading` until the upload is completed and verified, then `ready`. |
| `upload_expires_at` | string (date-time) \| null | No | When an upload that was not completed expires and is deleted. Set while `uploading`. |
| `urls_expire_at` | string (date-time) \| null | No | When the part URLs stop accepting uploads. Set while `uploading`. |

## BuildLogsUrl

A link to build logs.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | The URL for reading the build logs. |

## ChangeImpact

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `revoked_api_keys` | integer (int64) | Yes | The number of API keys the change would revoke. |

## ChargePage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `charges` | array of [Charge](#charge) | Yes | The charges in this page. |
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |

## ChargeReceiptPdf

The charge receipt PDF.

Type: string (binary)

## CompleteBuildContextUploadRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `region_id` | string | Yes | The region the upload was created in, as `POST /build-contexts` returned it. Required: a multi-region deployment routes the request to that region's servers by it. |

## Config

The `/config` response body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `analytics` | null \| [AnalyticsConfig](#analyticsconfig) | Yes | Browser analytics configuration. `null` when analytics is disabled. |
| `analytics_url` | string \| null | No | Public base URL for spending analytics. `null` when unavailable. |
| `api_url` | string \| null | No | Public base URL of this API when the deployment advertises one. |
| `billing_enabled` | boolean | Yes | Whether billing features are available. |
| `build_sha` | string | Yes | API build identifier; `unknown` when unavailable. |
| `built_at` | string (date-time) \| null | No | API build time; `null` when unavailable. |
| `docs_url` | string \| null | No | Public documentation site URL for this deployment. |
| `oidc` | null \| [OidcPublicConfig](#oidcpublicconfig) | Yes | Login settings. `null` when login is unavailable. |
| `ssh_gateway` | null \| [SshGatewayConfig](#sshgatewayconfig) | Yes | SSH gateway endpoint clients should use. `null` when the deployment does not publish one. |
| `toolbox_url` | string \| null | No | Base URL for sandbox tools that the browser should use. |
| `version` | string | Yes | Platform version, or `0.0.0-dev` when unavailable. |

## CouponRedemption

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | The redeemed coupon code. |
| `credit_cents` | integer (int64) | Yes | The granted credit in cents. |
| `credit_expires_at` | string (date-time) \| null | No | When the granted credit expires, or `null` when the expiry is not known. |
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `redeemed_at` | string (date-time) | Yes | When the coupon was redeemed. |

## CpuCatalog

`GET /cpu-catalog` body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `arches` | array of [CpuArchAvailability](#cpuarchavailability) | Yes | The CPU architectures present in the catalog, with their availability. |
| `cpu_types` | array of [CpuType](#cputype) | Yes | CPU types and their availability. |
| `regions` | array of [CpuCatalogRegion](#cpucatalogregion) | Yes | Regions included in the catalog. |

## CreateBuildContextUploadRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytes` | integer (int64) | Yes | The size of the build-context tar in bytes, at most 1 GiB. |
| `dockerfile` | string \| null | No | Path of the Dockerfile within the context. Defaults to `Dockerfile`. |
| `region_id` | string \| null | No | The region the image will be built in. When omitted, the project's default region is used, then the organization's, then the platform's default region. A build can use the upload only in this region. |
| `sha256` | string | Yes | The SHA-256 of the build-context tar, as 64 lowercase hex characters. |
| `tree_hash` | string \| null | No | The canonical tree hash of the build context, as 64 lowercase hex characters. Optional: when set, the upload is refused unless the stored archive hashes to it. |

## CreateImageMultipartRequest

The `multipart/form-data` variant of `POST /images`: a Dockerfile build
with an uploaded build context.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | string (binary) | Yes | The build-context tar, at most 64 MiB. Upload a larger context, up to 1 GiB, with `POST /build-contexts` and build it with `context_upload_id`. |
| `cpu_arch` | string \| null | No | The CPU architecture: `amd64` or `arm64`. Omit it to use the region default. |
| `dockerfile` | string \| null | No | Path of the Dockerfile within the context. Defaults to `Dockerfile`. |
| `idle_expiry_seconds` | integer (int64) \| null | No | The idle retention window in seconds for an anonymous image. Omitted or -1 uses the server maximum. Reuse only extends retention; promote to keep it. |
| `name` | string \| null | No | The project-unique image name. Omit it to create an anonymous image. |
| `region_id` | string \| null | No | The region to create the image in. When omitted, the project's default region is used, then the organization's, then the platform's default region. |

## CreateImageRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context_upload_id` | string (uuid) \| null | No | A `ready` build-context upload from `POST /build-contexts` to build: the Dockerfile at the upload's `dockerfile` path, with the uploaded archive as its context. The image must be created in the upload's region. Mutually exclusive with `source` and `dockerfile`. |
| `cpu_arch` | string \| null | No | The CPU architecture: `amd64` or `arm64`. Omit it to use the region default. |
| `dockerfile` | string \| null | No | An inline, self-contained Dockerfile body to build. Local files cannot be used with `COPY` or `ADD`; use `multipart/form-data` to upload a build context. Mutually exclusive with `source`. |
| `idle_expiry_seconds` | integer (int64) \| null | No | The idle-retention window in seconds for an anonymous image: the image is deleted once this long has passed without a sandbox being created from it, and every create from the image restarts the clock. Allowed only without `name`; a named image is permanent, and `idle_expiry_seconds` with `name` is a `400`. Omitted or `-1` uses the maximum, 7 days by default; `1` up to that maximum sets the window. Reusing an anonymous image only extends its retention. Promote it to keep it. `0`, values below `-1`, and values above the maximum answer `400 IDLE_OUT_OF_RANGE`, whose body carries `max`. |
| `name` | string \| null | No | The project-unique image name. Omit it to create an anonymous image. |
| `region_id` | string \| null | No | The region to create the image in. When omitted, the project's default region is used, then the organization's, then the platform's default region. |
| `source` | null \| [PublicImageSource](#publicimagesource) | No | A registry image or an existing project image. Mutually exclusive with `dockerfile`; exactly one source is required. |

## CreateInvitationRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | The email address to invite. |
| `roles` | array of string \| null | No | Absent ⇒ `["developer"]`; an explicit empty array is a 400. |

## CreateMacosSandboxRequest

Settings for creating a macOS sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean \| null | No | With `reservation: "new"` only: whether the bought reservation renews itself while a sandbox is active on it. Defaults to the organization's auto-reserve setting. |
| `cores` | integer (int32) \| null | No | CPU cores for this sandbox, at least 4. A Mac core is one CPU of the Mac (Apple Silicon has no SMT). Omitted or null uses the Mac model's default size (`default_size` in `GET /mac-models`). |
| `create_timeout_seconds` | integer (int64) \| null | No | Seconds the sandbox can take to reach `running`: 3600 by default, or 86400 for an image captured on an earlier version of macOS sandboxes. `-1` uses the maximum, 86400. After this time, the platform deletes the sandbox. The time includes the wait for a Mac. A reservation that this create bought stays bought and charged after that delete. |
| `disk_mib` | integer (int32) \| null | No | Disk for this sandbox in MiB, macOS included, at least 81920. Omitted or null uses the Mac model's default size (`default_size` in `GET /mac-models`). For a create from a captured image, omitted or null uses the image's `disk_mib`, and a smaller value returns 400. The disk and the disk volumes must fit the disk space of the sandbox's Mac (`sandbox_disk_mib` in `GET /mac-models`). |
| `env` | map of string | No | Sandbox-specific environment variables. Names must be valid environment variable names. |
| `idempotency_key` | string \| null | No | Idempotency key; the `Idempotency-Key` header wins if both are set. It also covers a reservation the create buys: a retry never buys two. |
| `image` | string | Yes | The macOS image, by name or `img_…` id: a platform macOS image, typically `base-macos`, or a macOS image of this project in the request's region, such as an image captured from a macOS sandbox. |
| `labels` | map of string | No | User-defined labels. Not visible inside the sandbox. |
| `lifecycle_policy` | null \| [UpdateSandboxLifecyclePolicyRequest](#updatesandboxlifecyclepolicyrequest) | No | Sandbox lifecycle policy: idle stop and delete timeouts and a wall-clock deadline. Use `POST /sandboxes/{id}/pause` to pause a macOS sandbox. Project lifecycle defaults do not apply to macOS: omitted fields use platform defaults. |
| `memory_mib` | integer (int32) \| null | No | Memory for this sandbox in MiB, at least 4096. Omitted or null uses the Mac model's default size (`default_size` in `GET /mac-models`). |
| `name` | string \| null | No | Optional sandbox name (defaults to `sandbox-<short-id>`). |
| `network_policy` | null \| [SetSandboxNetworkPolicyRequest](#setsandboxnetworkpolicyrequest) | No | Egress policy, as on the Linux create: enforced from the sandbox's first boot. Change it later with `PUT /sandboxes/{id}/network-policy`. |
| `persistent` | boolean | No | Keep the sandbox's disk and machine across stop and start, and its memory across pause and resume. A start can run on any Mac of the organization. After a start on a different Mac, iCloud asks the user to sign in again. A reservation end or a Mac failure stops a sandbox that has started and never deletes it. |
| `ports` | array of [PortMapping](#portmapping) | No | Ports exposed when the sandbox starts. |
| `region_id` | string \| null | No | The region to create the sandbox in. When omitted: the named reservation's region. Otherwise, when Macs are offered in exactly one region, that region; when they are offered in several, the project's or organization's default region if it is one of them, else `region_id` is required (`400 BAD_REQUEST`). With no Mac region offered, the project's default region, then the organization's, then `earth`. |
| `reservation` | string \| null | No | Omitted uses any Mac reservation of the organization in the region that fits this size. "new" buys a reservation of the cheapest available Mac model that fits this size. A reservation ID uses only that reservation. An accepted create can wait for space on a Mac until `create_timeout_seconds`. |
| `secrets` | array of string | No | Names of project secrets to attach. Secret values are used only for requests to their allowed hosts. |
| `volumes` | array of [VolumeMount](#volumemount) | No | Disk volumes to attach, as on Linux: at most 8, each read-write. Each volume uses its `size_gib` (100 GiB when omitted) of disk space on the sandbox's Mac, beside the sandbox's disk. A sandbox with volumes cannot be persistent. A bucket volume returns 400. |
| `wait_seconds` | integer (int64) \| null | No | Seconds to hold the response until the sandbox is `running`, capped at 3 by default. Omitted uses the cap, `0` returns immediately, and a negative value returns 400. The response carries the status reached when the wait ends. |

## CreateOrganizationApiKeyRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | Optional expiry; must be in the future. Absent means it never expires. |
| `name` | string | Yes | The key's display name. |
| `org_permissions` | array of string | Yes | The organization permissions the key holds. Required, with at least one entry: a key never gets a default or implied permission set. A project permission is not a valid value here. |

## CreateOrganizationRegionRequest

The body of an organization-region create.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The display name, 1 to 100 characters. |
| `parent_region_id` | string | Yes | The ID of a parent region from the organization's parent regions. |
| `sandbox_cidr` | string \| null | No | The private IPv4 range sandbox addresses are allocated from, a prefix length between 12 and 20. Default `10.213.0.0/16`. |
| `subnet_prefix_length` | integer (int32) \| null | No | The prefix length of each runner's subnet, between 22 and 28 and longer than the prefix length of `sandbox_cidr`. Default 24. |

## CreateOrganizationRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The organization name: at most 64 characters after trimming, with no control characters. |

## CreateOrganizationRoleRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | The role's purpose. |
| `name` | string | Yes | The role name, unique in the organization ignoring case. Leading and trailing whitespace is removed and internal whitespace runs collapse to one space; the result must be 1 to 64 characters. |
| `organization_permissions` | array of string | Yes | The organization permissions the role grants. |
| `project_permissions` | array of string | Yes | The project permissions the role grants. |

## CreateProjectApiKeyRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | Optional expiry; must be in the future. Absent means it never expires. |
| `name` | string \| null | No | The key's display name. |
| `project_permissions` | array of string | Yes | The project permissions the key holds. Required, with at least one entry: a key never gets a default or implied permission set. |
| `service_account_id` | string (uuid) \| null | No | The service account that owns this key, or `null` for the current user. |
| `sync_to_v0` | boolean \| null | No | Whether the v0 ↔ v2 key sync may copy this key to Daytona v0. Absent = `true`. Only a key a person mints in the organization's `default` project is ever copied; elsewhere the field is ignored and the response says `false`. A Daytona v0 copy can read every sandbox, snapshot and registry of the organization on Daytona v0, which has no read permissions; `false` keeps the key on this platform only. Change it later by updating the API key. |

## CreateProjectRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The project name: at most 64 characters after trimming, with no control characters. `default` is reserved. |

## CreateRegionProxyTokenRequest

The body of a proxy-token create. Name `expires_at` or set `no_expiry`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | When the token expires; must be in the future. |
| `name` | string \| null | No | The display name, 1 to 100 characters. |
| `no_expiry` | boolean | No | Whether the token never expires. |

## CreateRegionRegistrationTokenRequest

The body of a registration-token create.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_in_seconds` | integer (int64) \| null | No | Seconds until the token expires, 300 to 2592000. Default 604800. |
| `max_uses` | integer (int32) \| null | No | How many runners the token may enroll, 1 to 1000. Default 100. |
| `name` | string | Yes | The display name, 1 to 100 characters. |

## CreateReservationRequest

POST /reservations body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean \| null | No | Renew the reservation near each period end while a macOS sandbox is active on it. Defaults to the organization's auto-reserve setting. |
| `model` | string \| null | No | Mac model slug from GET /mac-models. Omitted, null, or blank uses the region's default model, initially m4-10c-16g. If that model is unavailable, the purchase fails; it never upgrades to another model. |
| `region_id` | string | Yes | Region slug whose Macs to reserve. Blank or `local` names no region: when this API serves exactly one region with Macs, the reservation is made there; otherwise the project, organization, then platform default applies. |

## CreateReservationsBulkRequest

POST /reservations/bulk body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean \| null | No | Renew each reservation near each period end while a macOS sandbox is active on it. Defaults to the organization's auto-reserve setting. |
| `count` | integer (int32) | Yes | How many Macs to reserve, 1 to 100. |
| `min_count` | integer (int32) \| null | No | The fewest Macs to accept, 1 to `count`. Omitted means `count`: all or nothing. With fewer than `count` Macs free, or fewer left under the organization's Mac reservation limit, but at least `min_count`, the request reserves as many as it can. |
| `model` | string \| null | No | Mac model slug from GET /mac-models. Omitted, null, or blank uses the region's default model, initially m4-10c-16g. If that model is unavailable, the purchase fails; it never upgrades to another model. |
| `region_id` | string | Yes | Region slug whose Macs to reserve. Blank or `local` names no region: when this API serves exactly one region with Macs, the reservations are made there; otherwise the project, organization, then platform default applies. |

## CreateSandboxFromSnapshotRequest

Settings for creating a Linux sandbox from a snapshot.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `create_timeout_seconds` | integer (int64) \| null | No | Seconds allowed for the sandbox to reach `running`. Defaults to 3600; `-1` uses the maximum. |
| `idempotency_key` | string \| null | No | Key used to replay the same create operation safely. |
| `labels` | map of string | No | User-defined labels. |
| `lifecycle_policy` | null \| [UpdateSandboxLifecyclePolicyRequest](#updatesandboxlifecyclepolicyrequest) | No | Automatic timeout and idle-expiry behavior. |
| `name` | string \| null | No | Sandbox name. A name is generated when omitted. |
| `ports` | array of [PortMapping](#portmapping) | No | Ports exposed when the sandbox starts. |
| `region_id` | string \| null | No | The region to create the sandbox in. When omitted, the snapshot's region. |
| `snapshot` | string | Yes | Snapshot name or `snap_…` id. Required. |
| `wait_seconds` | integer (int64) \| null | No | Seconds to wait before returning. Defaults to 3; `0` returns immediately. |

## CreateSandboxImageRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_expiry_seconds` | integer (int64) \| null | No | The idle-retention window in seconds for an anonymous image: the image is deleted once this long has passed without a sandbox being created from it, and every create from the image restarts the clock. Allowed only without `name`; a named image is permanent, and `idle_expiry_seconds` with `name` is a `400`. The same rule as `POST /images`: omitted or `-1` uses the maximum, 7 days by default; `1` up to that maximum sets the window; `0`, values below `-1`, and values above the maximum answer `400 IDLE_OUT_OF_RANGE`, whose body carries `max`. Promote the image (`PATCH /images/{id}`) to keep it. |
| `name` | string \| null | No | The project-unique image name, or `null` for an anonymous image. |

## CreateSandboxRequest

Settings for creating a Linux sandbox from an image.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cores_max` | number (double) \| null | No | Maximum CPU, in cores (1 core = 2 vCPUs): the size the sandbox boots at. A positive multiple of 0.5; the system or plan cap when omitted. |
| `cpu` | number (double) \| null | No | Reserved CPU, in cores (1 core = 2 vCPUs). |
| `cpu_arch` | string \| null | No | The CPU architecture the sandbox requires. Omit it to use the region default — unless the image was imported from Daytona v0 and `cpu_type` is omitted too, in which case the architecture that image was imported for is used. |
| `cpu_type` | string \| null | No | Preferred CPU type. |
| `create_timeout_seconds` | integer (int64) \| null | No | Seconds allowed for the sandbox to reach `running`. Defaults to 3600; `-1` uses the maximum. |
| `disk_max_mib` | integer (int32) \| null | No | Per-sandbox disk limit in MiB. Same semantics as `cores_max`; when restoring a snapshot, it must equal the captured disk size or be absent. |
| `disk_mib` | integer (int32) \| null | No | Writable disk size in MiB. |
| `env` | map of string | No | Sandbox-specific environment variables (real values, verbatim). Names must be POSIX-ish identifiers (`[A-Za-z_][A-Za-z0-9_]*`). Names the platform reserves for its own use, including every `DAYTONA_*` name other than `DAYTONA_API_URL`, `DAYTONA_OTEL_ENDPOINT` and `DAYTONA_DOCKER_START` (so `DAYTONA_SANDBOX_TOKEN` too), fail the create with 400 naming the key. |
| `idempotency_key` | string \| null | No | Key used to replay the same create operation safely. |
| `image` | string \| null | No | Image name or `img_…` id. Omit to boot the platform default image. |
| `labels` | map of string | No | User-defined labels. |
| `lifecycle_policy` | null \| [UpdateSandboxLifecyclePolicyRequest](#updatesandboxlifecyclepolicyrequest) | No | Automatic timeout and idle-expiry behavior. |
| `memory_max_mib` | integer (int32) \| null | No | Per-sandbox memory limit in MiB; same semantics as `cores_max`. |
| `memory_mib` | integer (int32) \| null | No | Reserved memory in MiB. |
| `name` | string \| null | No | Sandbox name. A name is generated when omitted. |
| `network_policy` | null \| [SetSandboxNetworkPolicyRequest](#setsandboxnetworkpolicyrequest) | No | Outbound network rules applied to the sandbox. |
| `ports` | array of [PortMapping](#portmapping) | No | Ports exposed when the sandbox starts. |
| `region_id` | string \| null | No | The region to create the sandbox in. Any listed region, including `earth` (anywhere). When omitted: the project's default region, then the organization's, then `earth`. |
| `secrets` | array of string | No | Secret names made available to the sandbox. |
| `spot` | boolean | No | Whether to use discounted interruptible capacity. Defaults to `false`. |
| `user` | string \| null | No | Default operating-system user. |
| `volumes` | array of [VolumeMount](#volumemount) | No | Volumes mounted in the sandbox. |
| `wait_seconds` | integer (int64) \| null | No | Seconds to wait before returning. Defaults to 3; `0` returns immediately. |

## CreateSandboxSignedPreviewUrlRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_in_seconds` | integer (int64) \| null | No | Link lifetime in seconds. Defaults to 60. A value below 1, or above the deployment's ceiling — 7 days by default — answers 400. |

## CreateSandboxSnapshotRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The project-unique snapshot name. |

## CreateServiceAccountRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | The service account purpose, or `null` when omitted. |
| `name` | string | Yes | The service account name. |
| `roles` | array of string | Yes | The role identifiers to assign. |

## CreateSsoSetupLinkRequest

Settings for creating a single sign-on setup link.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intent` | [PortalIntent](#portalintent) | Yes | The setup area to open: `sso` for single sign-on or `dsync` for directory sync. |

## CreateTopUpSessionRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount_cents` | integer (int64) | Yes | The amount to add in cents. |

## CreateV0SandboxImportRequest

Settings for creating a sandbox import from Daytona v0.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `force` | boolean | No | Whether to create another import when a live import already exists; default `false`. |

## CreateVolumeRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bucket` | null \| [BucketOptions](#bucketoptions) | No | Settings for an existing bucket. Omit them to create a managed bucket. |
| `name` | string | Yes | The project-unique volume name. |
| `size_gib` | integer (int32) \| null | No | Scratch size in GiB. Defaults to 100. Disk volumes only — supplying it on a bucket volume is a 400. |
| `type` | null \| [VolumeType](#volumetype) | No | The volume type. Defaults to `disk`. |

## DeclineInvitationRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The invitation token. |

## Entitlements

The entitlements available to an organization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entitlements` | map of boolean | Yes | Every entitlement key, `true` when it is available to the organization. |

## ErrorBody

The JSON error envelope every non-2xx response carries.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytes` | integer (int64) \| null | No | Measured artifact size, in bytes. |
| `code` | [ApiErrorCode](#apierrorcode) | Yes | Stable machine-readable error code. |
| `current` | integer (int64) \| null | No | Current usage measured for the limit. |
| `entitlement` | string \| null | No | Organization capability required by the operation. |
| `feature` | string \| null | No | Product capability that is not enabled. |
| `limit` | string \| null | No | Name of the limit that was reached. |
| `max` | integer (int64) \| null | No | Maximum allowed value or usage cap. |
| `max_bytes` | integer (int64) \| null | No | Maximum allowed artifact size, in bytes. |
| `message` | string | Yes | Human-readable explanation of the error. |
| `replacement` | string \| null | No | Suggested alternative route. |
| `retry_after_seconds` | integer (int64) \| null | No | Suggested number of seconds to wait before retrying. |
| `source` | string | Yes | Service that produced the error. |
| `trace_id` | string \| null | No | Trace ID to quote when contacting support. |

## ExchangeTokenRequest

A token exchange request accepted as JSON or form data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audience` | string \| null | No | Target audience. Omit it, or send `daytona:api`, for a project-scoped token; send `daytona:analytics` for an organization-scoped token. Any other value is refused; the parameter may not be repeated. |
| `grant_type` | string | Yes | Must be `urn:ietf:params:oauth:grant-type:token-exchange`. |
| `org_id` | string (uuid) \| null | No | The organization for the analytics token. Required when `audience` is `daytona:analytics`; omitted (or `null`) otherwise. |
| `project_id` | string (uuid) \| null | No | The project for the API token. Required when `audience` is absent or `daytona:api`; omitted (or `null`) when `audience` is `daytona:analytics`. |
| `resource` | string \| null | No | RFC 8693 target resource. Explicit down-scoping is not supported; omit this parameter. |
| `scope` | string \| null | No | RFC 8693 scope request. Explicit down-scoping is not supported; omit this parameter. |
| `subject_token` | string | Yes | The sign-in token. It must match the bearer token on the request. |
| `subject_token_type` | string | Yes | Subject token type. |

## ForkSandboxOperation

The result of forking a sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `forked_from` | string | Yes | The ID of the source sandbox. |
| `id` | string | Yes | The ID of the new fork. |
| `status` | string | Yes | The fork's status at acceptance, always `pending`. A memory fork then lands `paused` and a disk-only fork lands `stopped`; a fork of a `running` source is brought up automatically. |
| `toolbox_proxy_url` | string | Yes | The fork’s toolbox base URL in its source region, also returned by `GET /sandboxes/{id}`. |

## ForkSandboxRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `memory` | boolean \| null | No | Whether to include memory (default `true`), allowing the fork to continue running processes. `false` copies only the disk and starts fresh, without pausing the source. A stopped source is always copied disk-only. macOS supports disk-only forks: omitted selects disk-only, and `true` returns `409 NOT_SUPPORTED_FOR_CLASS`. |
| `name` | string \| null | No | Optional name for the fork (defaults to "<source>-fork"). |

## Health

API health and build identity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `build_sha` | string | Yes | API build identifier; `unknown` when unavailable. |
| `built_at` | string (date-time) \| null | No | API build time; `null` when unavailable. |
| `status` | string | Yes | Health status. |
| `version` | string | Yes | Platform release version; `0.0.0-dev` when unavailable. |

## Image

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `anonymous` | boolean | Yes | Whether the image has no permanent name. |
| `bytes` | integer (int64) \| null | No | The image size in bytes, or null until the build completes. |
| `class` | string | Yes | The sandbox class supported by the image. |
| `created_at` | string (date-time) | Yes | When the image was created. |
| `default` | boolean | Yes | Whether this is the image a sandbox create without `image` boots. |
| `deprecated` | boolean | Yes | Whether this platform image is deprecated. A deprecated image is not listed and cannot be used by name, but its ID still resolves. |
| `disk_mib` | integer (int64) \| null | No | The disk size in MiB that a macOS sandbox created from this image gets when the create omits `disk_mib`; a create cannot ask for less. Set for images captured from a macOS sandbox; null for other images. |
| `error` | string \| null | No | Build failure reason; null unless `status` is `failed`. |
| `expires_at` | string (date-time) \| null | No | When an anonymous image expires, or null for a permanent image. |
| `format_outdated` | boolean | Yes | `format_version` is below the current format. Such an image converts on its first Linux sandbox create (which waits `queued` meanwhile) or ahead of time with `POST /images/{id}/convert`; other operations refuse it with `IMAGE_FORMAT_OUTDATED` until then. |
| `format_version` | integer (int32) | Yes | Image format version: `1` for images imported from Daytona v0, `2` for the current format. See `status` for image readiness. |
| `id` | string | Yes | The image ID. |
| `imported_from` | [ImportedFrom](#importedfrom) | No | The source platform and resource ID when this image was imported. |
| `layer_count` | integer (int32) \| null | No | The number of filesystem layers, or null until the build completes. |
| `name` | string \| null | No | The image name, or null for an anonymous image. |
| `origin` | string | Yes | How the image was created. |
| `platform` | boolean | Yes | Whether the platform publishes this image for every project. A project's own image with the same name takes precedence for that project, and platform images cannot be renamed, converted, or deleted. |
| `region_id` | string | Yes | The home region. |
| `region_ids` | array of string | Yes | Every region where the image is available. |
| `retention` | [ImageRetention](#imageretention) | Yes | The retention policy: `permanent` or `idle`. |
| `source` | null \| [ImageSourceValue](#imagesourcevalue) | No | The image source. |
| `status` | string | Yes | The build status. |
| `updated_at` | string (date-time) | Yes | When the image was last updated. |

## ImageConversion

An image format conversion result.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `converted` | boolean | Yes | `true` when this call started or joined a conversion; `false` when the image was already at the current format and nothing was enqueued. |
| `from_format` | integer (int32) | Yes | The image's format before the call, as `Image.format_version` reported it. |
| `id` | string | Yes | The image ID. |
| `status` | string | Yes | The image's status after the call: `pending`/`building` while it converts, or its own status when it was already at the current format. |
| `to_format` | integer (int32) | Yes | The format the conversion targets: the current one. |

## ImageOrigin

How an image was created.

Type: string: `registry`, `dockerfile`, `capture`, `windows`, `macos`

## ImagePage

Page of images (`GET /images`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `images` | array of [ImageListItem](#imagelistitem) | Yes | The images in this page. |
| `next_cursor` | string \| null | No | Opaque keyset token for the next page; null on the last page. |

## ImagePlatformFilter

Type: string: `true`, `false`, `any`

## ImageSearchClass

The `class` filter of `GET /images/search`.

Type: string: `linux`, `windows`, `macos`

## ImageSearchPage

A page of matching images.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `images` | array of [ImageListItem](#imagelistitem) | Yes | Matching images in this page. |
| `next_cursor` | string \| null | No | Continuation token for the next page; null on the last page. |
| `total` | integer (int64) | Yes | The number of matching images. Exact when `total_relation` is `eq`, and a lower bound of 10000 when it is `gte`. |
| `total_relation` | [SearchTotalRelation](#searchtotalrelation) | Yes | Whether `total` is exact (`eq`) or a lower bound (`gte`). |

## ImageSearchSort

The `sort` values of `GET /images/search`.

Type: string: `created_at`, `updated_at`, `name`, `bytes`

## ImageStatus

The build status of an image.

Type: string: `pending`, `building`, `ready`, `failed`

## InvitationLookup

What `POST /invitations/lookup` shows the token holder before they decide.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | The invited address — the one the email went to. |
| `expires_at` | string (date-time) | Yes | When the invitation expires. |
| `id` | string (uuid) | Yes | The invitation ID. |
| `invited_by` | string \| null | No | The inviter's display name, else their email; `null` when the inviting account no longer exists. |
| `org_id` | string (uuid) | Yes | The organization ID. |
| `org_name` | string | Yes | The organization name. |
| `role_names` | array of string | Yes | The display names of `roles`, in the same order. |
| `roles` | array of string | Yes | The role identifiers granted on acceptance. |

## InvitationPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invitations` | array of [Invitation](#invitation) | Yes | The organization invitations. |
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` at the end. |

## InvitationWithToken

Type: [Invitation](#invitation) & object

## InvoicePage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoices` | array of [Invoice](#invoice) | Yes | The invoices in this page. |
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |

## InvoicePdf

The invoice PDF.

Type: string (binary)

## LifecycleAction

The action a lifecycle trigger fires: `stop`, `pause`, or `delete`.

Type: string: `stop`, `pause`, `delete`

## LookupInvitationRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The invitation token. |

## MacCatalog

Free Macs and prices per Mac model, per region.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `regions` | array of [MacCatalogRegion](#maccatalogregion) | Yes | Every region the answer covers, in catalog order. |

## MacModelList

The registered Mac models.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mac_models` | array of [MacModel](#macmodel) | Yes | Every registered Mac model, ordered by ID. |

## MacReservation

A Mac reservation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `activated_at` | string (date-time) \| null | No | When the reservation became active. |
| `auto_renew` | boolean | Yes | The reservation renews itself shortly before `period_end` (an hour by default) while a macOS sandbox is active on it; an idle reservation lapses instead. |
| `capacity` | null \| [MacResources](#macresources) | No | The cores, memory and disk space for sandboxes of this reservation's Mac, set at purchase. Null when unknown; such a reservation accepts no new sandbox. |
| `created_at` | string (date-time) | Yes | When the reservation was created. |
| `end_reason` | null \| [MacReservationEndReason](#macreservationendreason) | No | Why the reservation ended, or `null` while it is live. |
| `ended_at` | string (date-time) \| null | No | When the reservation ended. |
| `id` | string | Yes | The reservation ID. |
| `model` | string \| null | No | The reserved Mac model, fixed at purchase, including renewal and replacement. Null when model information is unavailable; such a reservation accepts no new sandbox. |
| `org_id` | string (uuid) | Yes | The organization ID. |
| `origin` | [MacReservationOrigin](#macreservationorigin) | Yes | How the reservation was bought: `explicit` by `POST /reservations` or a create with `reservation: "new"`, and `auto` by a macOS create or start under the organization's auto-reserve setting. |
| `pending_mac_started_at` | string (date-time) \| null | No | When the reservation last began to wait for a Mac: at its first charge, or when it moved after a Mac failure. Kept after a Mac takes it. |
| `period_end` | string (date-time) \| null | No | When the reservation ends unless renewed. Absent until a Mac first takes the reservation; period 1 starts then, so the wait for a Mac is not paid time. |
| `period_n` | integer (int32) | Yes | The current paid period (1-based). |
| `period_seconds` | integer (int64) | Yes | The period length in seconds. |
| `period_started_at` | string (date-time) \| null | No | When the current period started. |
| `project_id` | string (uuid) | Yes | The project whose key bought the reservation. The reservation serves every project of the organization; this project's monthly budget gates its renewals, manual and automatic, which answer `PROJECT_BUDGET_EXCEEDED` while the project is held. |
| `region_id` | string | Yes | The reservation region. |
| `reissued_at` | string (date-time) \| null | No | Set when the reservation moved to another Mac after a Mac failure. |
| `renewal_error` | string \| null | No | Why the renewal of the next period failed (billing refused it, or the balance was too low); the reservation ends at `period_end` unless renewed by hand. Null when no renewal has failed. |
| `renewal_pending` | boolean | Yes | A renewal charge is still waiting for billing's answer. |
| `resources_used` | [MacResources](#macresources) | Yes | The cores, memory and disk space in use on this reservation's Mac. Paused sandboxes and sandboxes with status `deleting` count. |
| `slots_used` | integer (int64) | Yes | macOS sandboxes currently occupying this reservation's Mac. |
| `status` | [MacReservationStatus](#macreservationstatus) | Yes | The reservation status. |

## MacReservationBatch

The reservations one bulk purchase created.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requested` | integer (int32) | Yes | The request's count. |
| `reservations` | array of [MacReservation](#macreservation) | Yes | The created reservations, one per reserved Mac, each with its own ID, period and charge. |
| `reserved` | integer (int32) | Yes | How many reservations this request created, from `min_count` to `count`. A reservation whose charge did not succeed counts here and shows status `failed` with end reason `charge_failed`. |

## MacosSettings

An organization's macOS settings.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `macos_auto_reserve` | boolean | Yes | Whether a macOS create or start buys a Mac reservation when the organization has none in the region. On unless an admin turns it off. |
| `macos_auto_reserve_disabled_at` | string (date-time) \| null | No | When an admin last turned auto-reserve off; null while it is on. |
| `macos_auto_reserve_disabled_by` | string (uuid) \| null | No | The admin who last turned auto-reserve off; null while it is on, or when no admin was recorded. |
| `macos_auto_reserve_max_reservations` | integer (int32) | Yes | The most live auto-created reservations the org may hold at once. |

## MemberRemovalPreview

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `revoked_api_keys` | integer (int64) | Yes | The number of API keys the removal would revoke. |
| `user_id` | string (uuid) | Yes | The user ID that would be removed. |

## MintSandboxAccessTokenRequest

`POST …/access-token` request. All fields optional; an absent (or empty)
body is the full default mint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operations` | array of string \| null | No | Requested operation subset (the sandbox-operation vocabulary: `toolbox`, `toolbox:exec`, `toolbox:fs`, `toolbox:git`, `desktop`, `ssh`, `sandbox:stop`, `sandbox:pause`, `sandbox:delete`). Omitted = the minter's full grantable set. An empty list is a valid ports-only grant. Unknown strings, and operations outside the minter's grantable set, are a 400 — never a silent narrowing. |
| `ports` | array of integer (int32) \| null | No | Private-preview ports the token may reach: 1 to 65535, at most 128, with duplicates collapsed. The sandbox daemon's ports 2280, 2281 and 22220 are never preview ports and are refused. Omitted grants all ports, and `[]` grants none. |
| `ttl_seconds` | integer (int64) \| null | No | Token lifetime in seconds. Omitted = the deployment default (3600 unless the deployment overrides it); values above the deployment cap (86400 by default) are a 400. `expires_at` in the response is authoritative. |

## Msa

The organization's master services agreement (MSA) with Daytona: its
commits and its negotiated discounts.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `commits` | array of [MsaCommit](#msacommit) | Yes | The commits under the organization's MSA, including upcoming and expired ones; empty when the organization has no MSA. |
| `discounts` | array of [MsaDiscount](#msadiscount) | Yes | The negotiated price discounts on the organization's billing contracts. |

## NetworkPolicy

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applied` | null \| [NetworkPolicyRules](#networkpolicyrules) | No | Rules currently active for the sandbox, or null when the policy is open. |
| `applied_revision` | integer (int64) \| null | No | Revision currently active for the sandbox. |
| `applied_start_id` | string \| null | No | The sandbox start the active revision was applied to, or `null` when no revision is active. |
| `desired` | null \| [NetworkPolicyRules](#networkpolicyrules) | No | Requested rules, or null when the policy is open. |
| `desired_revision` | integer (int64) | Yes | Revision of the requested rules. |
| `error` | string \| null | No | Failure detail when the requested rules could not be applied. |
| `status` | string \| null | No | Application status of the requested rules. |

## Organization

An organization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `budget_stop_grace_seconds` | integer (int64) | Yes | The delay before budget-held sandboxes are stopped or deleted; macOS sandboxes, which run on a prepaid Mac reservation, keep running. |
| `created_at` | string (date-time) | Yes | When the organization was created. |
| `from_v0` | boolean | Yes | Whether the organization was migrated from Daytona v0. |
| `id` | string (uuid) | Yes | The organization ID. |
| `max_sandbox_timeout_seconds` | integer (int32) \| null | Yes | The organization's own cap on sandbox timeouts, in seconds; null uses the plan maximum, or the platform maximum when there is no plan maximum. The plan maximum bounds this value; `GET /orgs/{id}/limits` reports the cap in effect. |
| `name` | string | Yes | The organization name. |
| `personal` | boolean | Yes | Whether this is the user's personal organization. |
| `preview_warning_disabled` | boolean | Yes | Whether sandbox previews skip the warning page. |
| `sso_linked` | boolean | Yes | Whether the organization is linked to its single sign-on configuration. |
| `sso_organization_id` | string \| null | Yes | The ID of the single sign-on organization the organization is linked to; null when `sso_linked` is false. |
| `suspended` | boolean | Yes | Whether new resource creation is suspended. |
| `suspended_reason` | string \| null | No | The member-visible suspension reason, when available. |
| `updated_at` | string (date-time) | Yes | When the organization was last updated. |
| `v0_membership_sync_enabled` | boolean | Yes | Whether membership changes sync with the Daytona v0 organization of the same ID. When true, removing a member also removes them from the Daytona v0 organization. |

## OrganizationApiKey

An organization API key without its secret token.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the API key was created. |
| `created_by` | string (uuid) \| null | No | The user who created the API key, when visible. |
| `expires_at` | string (date-time) \| null | No | When the API key expires, or null when it does not expire. |
| `id` | string (uuid) | Yes | The API key ID. |
| `key_prefix` | string \| null | No | The recognizable leading token characters, when available. |
| `key_suffix` | string \| null | No | The recognizable trailing token characters, when available. |
| `last_used_at` | string (date-time) \| null | No | When the API key was last used, or null when unknown. |
| `name` | string | Yes | The API key name. |
| `org_id` | string (uuid) | Yes | The organization ID. |
| `org_permissions` | array of string | Yes | The organization permissions granted to the API key. |
| `revoked_at` | string (date-time) \| null | No | When the API key was revoked, or null while active. |

## OrganizationApiKeyPage

A page of organization API keys.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or null when this is the last page. |
| `organization_api_keys` | array of [OrganizationApiKey](#organizationapikey) | Yes | The organization API keys in this page. |

## OrganizationApiKeyWithToken

A newly created organization API key and its one-time secret token.

Type: [OrganizationApiKey](#organizationapikey) & object

## OrganizationFeatureFlags

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flags` | map of boolean | Yes | The published feature keys enabled for the organization. Disabled keys are omitted. |

## OrganizationLimits

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_keys_per_organization` | [UsageLimit](#usagelimit) | Yes | The organization's live API-key limit and current usage. |
| `api_keys_per_project` | [UsageLimit](#usagelimit) | Yes | The maximum number of live API keys in any one project and the highest current usage. |
| `image_builds` | [ImageBuildLimits](#imagebuildlimits) | Yes | Concurrent image-build limits. |
| `mac_reservations` | [UsageLimit](#usagelimit) | No | Mac reservations the organization holds: pending, active or ending. Renewals do not count again. |
| `members` | [MemberLimits](#memberlimits) | No | Organization member limits. Omitted for project-scoped callers. |
| `sandbox_resources` | [SandboxResourceLimits](#sandboxresourcelimits) | No | Per-sandbox resource maximums for Linux sandboxes. |
| `sandbox_timeout` | [SandboxTimeoutLimits](#sandboxtimeoutlimits) | Yes | Sandbox timeout maximums. |
| `sandboxes` | [SandboxLimits](#sandboxlimits) | Yes | Sandbox count limits. |
| `secrets_per_project` | [UsageLimit](#usagelimit) | Yes | The maximum number of secrets in any one project and the highest current usage. |
| `storage` | [StorageLimits](#storagelimits) | Yes | Volume, image, and snapshot count limits. |

## OrganizationMember

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assignable_project_permissions` | array of string | Yes | The project permissions the member may grant. |
| `email` | string | Yes | The member's email address. |
| `joined_at` | string (date-time) | Yes | When the user joined the organization. |
| `name` | string \| null | No | The member's display name. |
| `org_permissions` | array of string | Yes | The member's effective organization permissions. |
| `roles` | array of string | Yes | The assigned role identifiers. |
| `user_id` | string (uuid) | Yes | The user ID. |

## OrganizationMemberPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `members` | array of [OrganizationMember](#organizationmember) | Yes | The organization members. |
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` at the end. |

## OrganizationPage

A page of organizations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or null when this is the last page. |
| `organizations` | array of [OrganizationListItem](#organizationlistitem) | Yes | The organizations in this page. |

## OrganizationRegion

A region an organization created on its own infrastructure.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the region was created. |
| `id` | string | Yes | The region ID. Generated when the region is created; pass it as the region of a sandbox create. |
| `name` | string | Yes | The display name. |
| `parent_region_id` | string | Yes | The ID of the parent region this region was created under. |
| `preview_domain` | string \| null | No | The base domain of the region's preview URLs, or `null` when none is set. |
| `runner_count` | integer (int64) | Yes | The number of runners enrolled in the region. |
| `sandbox_cidr` | string | Yes | The private IPv4 range sandbox addresses are allocated from. |
| `status` | [RegionStatus](#regionstatus) | Yes | Whether the region accepts new sandboxes. |
| `subnet_prefix_length` | integer (int32) | Yes | The prefix length of the subnet each runner receives from `sandbox_cidr`. |
| `toolbox_proxy_url` | string \| null | No | The base URL of the region's proxy, or `null` when none is set. |
| `updated_at` | string (date-time) | Yes | When the region last changed. |

## OrganizationRegionPage

A page of organization regions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` on the last page. |
| `regions` | array of [OrganizationRegion](#organizationregion) | Yes | The regions on this page, ordered by ID. |

## OrganizationRole

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) \| null | No | When the role was created, or `null` for a built-in role. |
| `description` | string | Yes | The role's purpose. |
| `id` | string | Yes | The role ID: a built-in role's identifier, or a custom role's UUID. |
| `kind` | [OrganizationRoleKind](#organizationrolekind) | Yes | Whether the role is built in or defined by the organization. |
| `name` | string | Yes | The display name. |
| `organization_permissions` | array of string | Yes | The organization permissions the role grants. |
| `permissions` | array of string | Yes | Every permission the role grants: the project permissions, then the organization permissions. |
| `project_permissions` | array of string | Yes | The project permissions the role grants. |
| `updated_at` | string (date-time) \| null | No | When the role was last changed, or `null` for a built-in role. |

## OrganizationRoleList

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_custom_roles` | integer (int64) | Yes | The most custom roles the organization can define. |
| `roles` | array of [OrganizationRole](#organizationrole) | Yes | The built-in roles, then the organization's custom roles. |

## OrganizationRoleUpdate

A role update's result: the role and the keys the update revoked.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `revoked_api_keys` | integer (int64) | Yes | The number of API keys the update revoked. |
| `role` | [OrganizationRole](#organizationrole) | Yes | The updated role. |

## OrganizationRunner

A runner enrolled in an organization region.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `admin_state` | [OrganizationRunnerAdminState](#organizationrunneradminstate) | Yes | Whether the runner accepts new sandboxes. |
| `billed_cores` | number (double) \| null | No | The cores the runner is billed at per hour: its logical CPUs ÷ 2. `null` before the runner first reports its CPUs. |
| `enrolled_at` | string (date-time) | Yes | When the runner enrolled. |
| `id` | string | Yes | The runner ID. |
| `last_seen_at` | string (date-time) \| null | No | When the runner was last heard from, or `null` when never. |
| `node_name` | string | Yes | The Kubernetes node name the runner enrolled with. |
| `region_id` | string | Yes | The region the runner is enrolled in. |
| `sandbox_count` | integer (int64) | Yes | The number of sandboxes on the runner. |
| `status` | [OrganizationRunnerStatus](#organizationrunnerstatus) | Yes | Whether the runner is connected. |
| `updated_at` | string (date-time) | Yes | When the runner was last cordoned or uncordoned, or when it enrolled. |
| `version` | string \| null | No | The runner software version, or `null` when not reported yet. |

## OrganizationRunnerPage

A page of a region's runners.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` on the last page. |
| `runners` | array of [OrganizationRunner](#organizationrunner) | Yes | The runners on this page. |

## OrganizationServiceAccount

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `archived_at` | string (date-time) \| null | No | When the service account was archived, or `null`. |
| `created_at` | string (date-time) | Yes | When the service account was created. |
| `created_by` | string (uuid) \| null | No | The user who created the service account, or `null`. |
| `description` | string \| null | No | The optional description. |
| `id` | string (uuid) | Yes | The service account ID. |
| `live_key_count` | integer (int64) | Yes | The number of active API keys owned by the service account. |
| `name` | string | Yes | The service account name. |
| `org_id` | string (uuid) | Yes | The organization ID. |
| `org_permissions` | array of string | Yes | The effective permissions granted by the roles. |
| `roles` | array of string | Yes | The assigned role identifiers. |
| `updated_at` | string (date-time) | Yes | When the service account was last updated. |

## OrganizationServiceAccountPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` at the end. |
| `service_accounts` | array of [OrganizationServiceAccount](#organizationserviceaccount) | Yes | The service accounts. |

## OtelConfig

An organization's telemetry configuration: the endpoint and the names of
the configured request headers. Header values are write-only and are never
returned.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) \| null | Yes | When the configuration was created, or null when it is unset. |
| `endpoint` | string \| null | Yes | The tenant's OTLP/HTTP endpoint. |
| `header_names` | array of string | Yes | Names of the request headers configured; values are write-only and never returned. |
| `updated_at` | string (date-time) \| null | Yes | When the configuration was last updated, or null when it is unset. |

## ParentRegionList

The parent regions the organization may create a region under.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent_regions` | array of [ParentRegion](#parentregion) | Yes | The parent regions, ordered by ID. |

## PaymentMethodPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |
| `payment_methods` | array of [PaymentMethod](#paymentmethod) | Yes | The payment methods in this page. |

## PermissionList

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `permissions` | array of [Permission](#permission) | Yes | The available permissions. |

## PlanList

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plans` | array of [Plan](#plan) | Yes | The billing plan catalog. |

## PlanName

Type: string: `starter`, `team`, `enterprise`

## PortMapping

One port exposed when the sandbox is created.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `port` | integer (int32) | Yes | The sandbox TCP or UDP port. |
| `proto` | string | No | The transport protocol. Defaults to `tcp`. |

## PortalIntent

The setup area opened by a configuration link.

Type: string: `sso`, `dsync`

## PreviewMemberUpdateRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roles` | array of string | Yes | The member's complete new role set. |

## PreviewOrganizationRoleUpdateRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | The new role purpose. |
| `name` | string | No | The new role name. Whitespace is normalized as on create; the result must be 1 to 64 characters. |
| `organization_permissions` | array of string | No | The complete new set of organization permissions. |
| `project_permissions` | array of string | No | The complete new set of project permissions. |

## PreviewServiceAccountUpdateRequest

The same body as the update, previewed without applying it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | The replacement description; `null` clears it. |
| `name` | string \| null | No | The replacement name. |
| `roles` | array of string \| null | No | The replacement role identifiers. |

## PreviewUrl

A preview URL and its access token.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | Secret value sent in the `x-daytona-preview-token` header. A sandbox access token also works as an Authorization Bearer token or in the `daytona_token` query parameter; an opaque preview token works only in the header. |
| `url` | string | Yes | Host-based preview URL, `<scheme>://<port>-<sandbox_id>.<domain>/`. |

## PreviewWarning

An organization's preview-warning setting.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `disabled` | boolean | Yes | Whether sandbox previews skip the warning page. |

## PrivacyPolicyStatus

The signed-in user's standing against the required privacy policy.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accepted` | boolean | Yes | Whether the user has accepted the required version. A client should prompt for consent only on an explicit `false`. |
| `accepted_at` | string (date-time) \| null | No | When the user last accepted a version; `null` if never. |
| `accepted_version` | string \| null | No | The version the user last accepted, whatever version is required now. |
| `url` | string \| null | No | Where the current policy text is published; `null` when no consent is required. |
| `version` | string \| null | No | Version the platform currently requires; `null` when it requires no consent, in which case `accepted` is always `true`. |

## Project

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the project was created. |
| `created_by` | string (uuid) \| null | No | The user who created the project, when visible. |
| `default` | boolean | Yes | Whether this is the organization's default project. |
| `id` | string (uuid) | Yes | The project ID. |
| `name` | string | Yes | The project name. |
| `org_id` | string (uuid) | Yes | The organization ID. |
| `updated_at` | string (date-time) | Yes | When the project was last updated. |

## ProjectApiKey

A project API key without its secret token.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the API key was created. |
| `created_by` | string (uuid) \| null | No | The user who created the API key, when visible. |
| `expires_at` | string (date-time) \| null | No | When the API key expires, or null when it does not expire. |
| `id` | string (uuid) | Yes | The API key ID. |
| `imported_from` | string \| null | No | `"v0"` when the key was created on Daytona v0 and imported by the v0 ↔ v2 key sync; `null` for a key created on this platform. |
| `key_prefix` | string \| null | No | The recognizable leading token characters, when available. |
| `key_suffix` | string \| null | No | The recognizable trailing token characters, when available. |
| `last_used_at` | string (date-time) \| null | No | When the API key was last used, or null when unknown. |
| `name` | string | Yes | The API key name. |
| `project_id` | string (uuid) | Yes | The project ID. |
| `project_permissions` | array of string | Yes | The project permissions granted to the API key. |
| `revoked_at` | string (date-time) \| null | No | When the API key was revoked, or null while active. |
| `service_account_id` | string (uuid) \| null | No | The service account that owns the API key, when applicable. |
| `service_account_name` | string \| null | No | The service account name, when applicable and available. |
| `sync_to_v0` | boolean | Yes | Whether the v0 ↔ v2 key sync copies this key to Daytona v0 (for an organization that is kept in sync with Daytona v0). `true` for a live key a person minted in the organization's `default` project unless it was opted out by updating the API key, and always for a live key imported from Daytona v0. `false` for every key the sync never copies: keys in other projects, service-account keys, the dashboard's own key named `default`, and revoked or expired keys. A Daytona v0 copy can read every sandbox, snapshot and registry of the organization on Daytona v0, which has no read permissions. |

## ProjectApiKeyPage

A page of project API keys.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or null when this is the last page. |
| `project_api_keys` | array of [ProjectApiKey](#projectapikey) | Yes | The project API keys in this page. |

## ProjectApiKeyWithContext

A project API key together with its tenant context.

Type: [ProjectApiKey](#projectapikey) & object

## ProjectApiKeyWithToken

A newly created project API key and its one-time secret token.

Type: [ProjectApiKey](#projectapikey) & object

## ProjectBudget

A project's monthly spend budget and its current state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) \| null | Yes | When the budget was first set, or null when no budget is set. |
| `evaluated_at` | string (date-time) \| null | No | When spend was last evaluated in the current period. `null` until the first evaluation in the period. |
| `exceeded_at` | string (date-time) \| null | No | When the project reached its budget this period. `null` while the project is under its budget. |
| `monthly_limit_cents` | integer (int64) \| null | Yes | The monthly budget, in US cents, or null when no budget is set. |
| `period_start_date` | string (date) \| null | Yes | The first day of the current budget period (the calendar month in UTC), as `YYYY-MM-DD`. |
| `spent_cents` | integer (int64) \| null | No | Month-to-date spend at list price, in US cents, from the last evaluation in the current period. `null` until the first evaluation in the period. |
| `stop_at` | string (date-time) \| null | No | When the budget grace period ends: `exceeded_at` plus the grace period. Running sandboxes may then be stopped or deleted; macOS sandboxes on prepaid reservations keep running. Null when there is no active hold or the deadline falls on or after the next UTC month, when the hold expires. |
| `updated_at` | string (date-time) \| null | Yes | When a member last set the budget, or null when no budget is set. Spend evaluations do not change it. |

## ProjectLifecyclePolicy

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `effective` | [EffectiveLifecyclePolicies](#effectivelifecyclepolicies) | Yes | The effective policies by sandbox class and persistence mode. |
| `policy` | [ProjectLifecycleDefaults](#projectlifecycledefaults) | Yes | The project-level lifecycle defaults. |

## ProjectLimits

The project's own sandbox limits, each with the project's current usage
against it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sandboxes` | [ProjectSandboxLimits](#projectsandboxlimits) | Yes | The project's sandbox count limits. A stored limit is always returned, and takes effect only while limit enforcement is turned on. |

## ProjectMemberList

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `added_user_ids` | array of string (uuid) | Yes | The user IDs added by the request. |

## ProjectMemberPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `members` | array of [ProjectMember](#projectmember) | Yes | The project members in this page. |
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |

## ProjectPage

A page of projects.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or null when this is the last page. |
| `projects` | array of [Project](#project) | Yes | The projects in this page. |

## ProjectServiceAccountList

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `added_service_account_ids` | array of string (uuid) | Yes | The service account IDs added by the request. |

## ProjectServiceAccountPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |
| `service_accounts` | array of [ProjectServiceAccount](#projectserviceaccount) | Yes | The service accounts in this page. |

## PublicImageSource

A caller-selectable image source.

Type: object \| object

## RedeemCouponRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | The coupon code. |

## RegionInstallation

The non-secret values an installation in the region needs.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_url` | string \| null | No | The API URL runners enroll against, or `null` when not configured. |
| `bootstrap_image` | string \| null | No | The image that runs the bootstrap script, or `null` when not configured. |
| `bus_url` | string \| null | No | The message bus address the region's runners connect out to, or `null` when not configured. Allow it in your firewall. |
| `chart` | string | Yes | The Helm chart that installs the region's runners, as an OCI reference. |
| `chart_version` | string \| null | No | The chart version to install, or `null` for the latest. |
| `installer_image` | string \| null | No | The installer image, or `null` when not configured. |
| `proxy_image` | string \| null | No | The proxy image, or `null` when not configured. |
| `region_id` | string | Yes | The region ID. |
| `terraform_module` | string \| null | No | The Terraform module, as an OCI reference, or `null` when not configured. |
| `usage_reporting_url` | string \| null | No | The address the region's runners report sandbox usage to, or `null` when not configured. Allow it in your firewall. |

## RegionList

The caller's regions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `default_region_id` | string \| null | Yes | ID of the caller's default region: the project's default region, else the organization's, else the platform's. A client sends a create that names no region to this region's `api_base_url`. `null` when that region is not listed. |
| `regions` | array of [Region](#region) | Yes | Every listed region in tree order: Earth first, then each region followed by the regions inside it. |

## RegionMultiplierList

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `region_multipliers` | array of [RegionMultiplier](#regionmultiplier) | Yes | Region price multipliers, with Earth first and the rest ordered by ID. |

## RegionProxyTokenPage

A page of the region's live proxy tokens.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` on the last page. |
| `proxy_tokens` | array of [RegionProxyToken](#regionproxytoken) | Yes | The proxy tokens, newest first. |

## RegionProxyTokenWithToken

A newly created proxy token and its one-time secret.

Type: [RegionProxyToken](#regionproxytoken) & object

## RegistrationTokenPage

A page of the region's live registration tokens.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or `null` on the last page. |
| `registration_tokens` | array of [RegistrationToken](#registrationtoken) | Yes | The registration tokens, newest first. |

## RegistrationTokenWithToken

A newly created registration token and its one-time secret.

Type: [RegistrationToken](#registrationtoken) & object

## Registry

Registry credential metadata returned by list and get endpoints. Passwords
are write-only and never returned.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the credentials were created. |
| `description` | string \| null | No | The user-facing description, or null when absent. |
| `host` | string | Yes | Normalized registry host (Docker Hub aliases collapse to `index.docker.io`). |
| `kind` | [RegistryKind](#registrykind) | Yes | Authentication kind. For `ecr_role` the username is the IAM role ARN the platform assumes. |
| `updated_at` | string (date-time) | Yes | When the credentials were last updated. |
| `username` | string | Yes | The registry username. |

## RegistryPage

Response for `GET /registries`: metadata only, never passwords.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The opaque continuation token, or null on the last page. |
| `registries` | array of [Registry](#registry) | Yes | The registry credentials in this page. |

## ReservationPage

GET /reservations response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The cursor for the next page, or null on the last page. |
| `reservations` | array of [MacReservation](#macreservation) | Yes | The reservations in this page. |

## RoleChangeImpact

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `affected_members` | integer (int64) | Yes | The number of members who hold the role. |
| `affected_service_accounts` | integer (int64) | Yes | The number of active service accounts that hold the role. |
| `pending_invitations` | integer (int64) | Yes | The number of pending invitations that grant the role. |
| `revoked_api_keys` | integer (int64) | Yes | The number of API keys the update would revoke. |

## RoleList

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roles` | array of [Role](#role) | Yes | The available roles. |

## RotateRegionProxyTokenRequest

The body of a proxy-token rotation: the successor's lifetime, and how long
the replaced token keeps working.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | When the successor expires; must be in the future. |
| `name` | string \| null | No | The successor's display name, 1 to 100 characters. |
| `no_expiry` | boolean | No | Whether the successor never expires. |
| `overlap_seconds` | integer (int64) \| null | No | Seconds the replaced token keeps working, 0 to 86400. Default 0. |

## Sandbox

A sandbox and its current configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class` | [SandboxClass](#sandboxclass) | Yes | Sandbox class. |
| `cores_max` | number (double) | Yes | Maximum CPU, in cores (1 core = 2 vCPUs): the size the sandbox boots at, a multiple of 0.5. |
| `cpu` | number (double) | Yes | Reserved CPU, in cores (1 core = 2 vCPUs). |
| `create_timeout_at` | string (date-time) \| null | No | Create deadline; absent after the sandbox reaches its target status. |
| `created_at` | string (date-time) \| null | No | When the sandbox was created. |
| `disk_max_mib` | integer (int32) \| null | No | Maximum writable disk size in MiB. |
| `disk_mib` | integer (int32) | Yes | Writable disk size in MiB. |
| `error` | string \| null | No | Failure detail, or null when no failure is recorded. |
| `forked_from` | string \| null | No | Source sandbox ID when this sandbox is a fork. |
| `id` | string | Yes | The sandbox ID. |
| `image` | null \| [ImageReference](#imagereference) | No | The image the sandbox was created from; absent when it was created from a snapshot. |
| `image_build_id` | string (uuid) \| null | No | Build ID associated with the sandbox image. |
| `image_ref` | string \| null | No | The original image reference when no image resource is associated. |
| `imported_from` | [ImportedFrom](#importedfrom) | No | The platform and sandbox ID this sandbox was imported from; absent for a sandbox created here. |
| `labels` | map of string \| null | No | User-defined sandbox labels. |
| `last_activity_at` | string (date-time) \| null | No | When activity was last observed. |
| `lifecycle_policy` | null \| [LifecyclePolicy](#lifecyclepolicy) | No | Automatic timeout and idle-expiry behavior. |
| `mac_boot_mode` | string \| null | No | How a macOS sandbox resumed; absent when it has not resumed. |
| `memory_max_mib` | integer (int32) \| null | No | Maximum memory in MiB. |
| `memory_mib` | integer (int32) | Yes | Reserved memory in MiB. |
| `name` | string | Yes | The sandbox name. |
| `persistent` | boolean \| null | No | Whether the sandbox keeps its disk across stop and start. |
| `port_map` | array of [PortAssignment](#portassignment) | Yes | Port assignments reported for the sandbox. |
| `region_id` | string | Yes | The region the sandbox runs in. |
| `reservation_id` | string \| null | No | The Mac reservation that the macOS sandbox runs on, or ran on last. Null before the sandbox first reaches a Mac; absent for other sandbox classes. |
| `snapshot` | null \| [SnapshotReference](#snapshotreference) | No | The snapshot the sandbox was created from; absent when it was created from an image. |
| `spot` | boolean \| null | No | Whether discounted interruptible capacity was requested. |
| `spot_evicted_at` | string (date-time) \| null | No | When discounted capacity reclaimed the sandbox; absent when it has not been reclaimed. |
| `ssh_gateway_host` | string \| null | No | SSH gateway host for the sandbox region. |
| `ssh_gateway_port` | integer (int32) \| null | No | SSH gateway port for the sandbox region. |
| `started_at` | string (date-time) \| null | No | When the sandbox most recently started. |
| `status` | string | Yes | Current lifecycle status. |
| `stopped_at` | string (date-time) \| null | No | When the sandbox most recently stopped. |
| `toolbox_proxy_url` | string \| null | No | Base URL for sandbox tools. |
| `updated_at` | string (date-time) \| null | No | When the sandbox was last updated. |
| `user` | string \| null | No | Default operating-system user. |

## SandboxAccessToken

`POST …/access-token` response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `access_token` | string (password) | Yes | The sandbox access token. |
| `expires_at` | string (date-time) | Yes | Absolute expiry (RFC 3339). The token cannot be refreshed — mint a fresh one through this route instead. |
| `operations` | array of string | Yes | The granted operations, canonical order — echoes what the token's `scope` claim carries. |
| `ports` | array of integer (int32) \| null | No | The granted ports (sorted, deduped), or null for all ports. |
| `token_type` | string | Yes | Always `Bearer`. |

## SandboxClass

Type: string: `linux`, `macos`

## SandboxCreateOperation

The result of an accepted sandbox create.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `access_token` | string (password) \| null | No | Secret access value returned once, or null on a replay. |
| `access_token_expires_at` | string (date-time) \| null | No | When the access value expires, or null when it has no expiry or this is a replay. |
| `create_timeout_at` | string (date-time) \| null | No | Create deadline, or null after the sandbox reaches its target status. |
| `id` | string | Yes | The sandbox ID. |
| `image` | null \| [ImageReference](#imagereference) | No | The image the sandbox boots. For a create without `image`, this is the platform default image; omitted for a sandbox restored from a snapshot. |
| `name` | string | Yes | Sandbox name (caller-provided or the generated `sandbox-<short-id>`). |
| `reservation_id` | string \| null | No | The Mac reservation that the sandbox runs on; null until the sandbox reaches a Mac. |
| `status` | string | Yes | Initial lifecycle status — `pending`, or the sandbox's current status on an idempotent replay. |
| `toolbox_proxy_url` | string | Yes | The sandbox’s toolbox base URL, also returned by `GET /sandboxes/{id}`. Use this URL for sandbox operations. |
| `wait_cap_seconds` | integer (int64) | Yes | Maximum server-side create wait in seconds. `0` when the server skipped the hold because the organization already has its limit of held creates; wait for the rest of `wait_seconds` client-side. |

## SandboxEventTicket

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_in_ms` | integer (int64) | Yes | Milliseconds until the ticket expires unused. |
| `subprotocol` | string | Yes | Protocol negotiated for the event stream. |
| `ticket` | string | Yes | One-time value presented when opening the event stream. |

## SandboxLabels

Response for `PUT /sandboxes/{id}/labels`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The sandbox ID. |
| `labels` | map of string | Yes | The sandbox’s labels. |

## SandboxLifecyclePolicy

Lifecycle update response for `PATCH /sandboxes/{id}/lifecycle-policy` and `POST /sandboxes/{id}/reset-idle-timer`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The sandbox ID. |
| `lifecycle_policy` | [LifecyclePolicy](#lifecyclepolicy) | Yes | The updated policy and its effective deadlines and activity information. |

## SandboxList

The requested sandboxes, after the optional wait.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sandboxes` | array of [Sandbox](#sandbox) | Yes | The requested sandboxes. |

## SandboxPage

A page of sandboxes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |
| `sandboxes` | array of [SandboxListItem](#sandboxlistitem) | Yes | The sandboxes in this page. |

## SandboxPort

One exposed sandbox port on the wire (with the computed URL).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the port was first exposed. |
| `port` | integer (int32) | Yes | TCP port exposed from the sandbox. |
| `public` | boolean | Yes | Whether the port is publicly accessible. |
| `url` | string | Yes | Host-based preview URL, `<scheme>://<port>-<sandbox_id>.<domain>/`. |

## SandboxPortPage

A keyset page of exposed sandbox ports.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | Opaque continuation token, or null on the last page. |
| `ports` | array of [SandboxPort](#sandboxport) | Yes | Exposed sandbox ports in this page. |

## SandboxSearchPage

A page of matching sandboxes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | Continuation token for the next page; null on the last page. |
| `sandboxes` | array of [SandboxListItem](#sandboxlistitem) | Yes | Matching sandboxes in this page. |
| `total` | integer (int64) | Yes | The number of matching sandboxes. Exact when `total_relation` is `eq`, and a lower bound of 10000 when it is `gte`. |
| `total_relation` | [SearchTotalRelation](#searchtotalrelation) | Yes | Whether `total` is exact (`eq`) or a lower bound (`gte`). |

## SandboxSearchSort

Type: string: `created_at`, `updated_at`, `last_activity_at`, `name`, `cores`, `memory_mib`, `disk_mib`

## SandboxSecrets

The secrets attached to a sandbox: the requested names and how far the
sandbox has applied them.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applied_revision` | integer (int64) \| null | No | Revision the sandbox has applied, or null before the first one. |
| `capture_status` | string \| null | No | For a restored or forked sandbox, how much of the source's secrets the copy received: `complete`, `partial` or an unknown status. |
| `capture_unresolved_count` | integer (int32) \| null | No | For a `partial` copy, how many of the source's secrets the copy did not receive. |
| `desired_revision` | integer (int64) | Yes | Revision of the requested secrets. |
| `error` | string \| null | No | Failure detail when the requested secrets could not be applied. |
| `secrets` | array of string | Yes | Names of the project secrets requested for the sandbox. |
| `status` | string \| null | No | Application status of the requested secrets: `pending`, `applied` or `failed`; null before the first change. |

## SandboxStatus

Type: string: `queued`, `pending`, `assigned`, `booting`, `running`, `pausing`, `paused`, `stopping`, `stopped`, `deleting`, `deleted`, `failed`, `lost`

## SandboxUsage

Current resource use for a sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sandbox_id` | string | Yes | The sandbox ID. |
| `usage` | array of [SandboxUsageSample](#sandboxusagesample) | Yes | Latest resource measurements for the sandbox. |

## SandboxUsageHistory

Historical resource usage for a sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `available` | boolean | Yes | Whether usage history is available. When `false`, `periods` is empty and `resolution` is absent. |
| `periods` | array of [UsagePeriod](#usageperiod) | Yes | Usage buckets in chronological order. |
| `resolution` | null \| [UsageHistoryResolution](#usagehistoryresolution) | No | Effective bucket size. Omitted when usage history is unavailable. |
| `sandbox_id` | string | Yes | The sandbox ID. |

## Secret

Secret metadata. The value is write-only.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allowed_domains` | array of string | Yes | The hosts the secret's value may be sent to. `["*"]` means any host the platform has verified; an empty list means the secret is sent nowhere. |
| `created_at` | string (date-time) | Yes | When the secret was created. |
| `description` | string \| null | No | The user-facing description, or null when absent. |
| `name` | string | Yes | The secret name. |
| `updated_at` | string (date-time) | Yes | When the secret was last updated. |

## SecretPage

GET /secrets response envelope.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The opaque continuation token, or null on the last page. |
| `secrets` | array of [Secret](#secret) | Yes | The secrets in this page. |

## SetAutomaticTopUpRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target_cents` | integer (int64) | Yes | The balance targeted by a top-up, in cents. |
| `threshold_cents` | integer (int64) | Yes | The balance that triggers a top-up, in cents. |

## SetBalanceNotificationRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `threshold_cents` | integer (int64) | Yes | The notification threshold in cents. |

## SetBillingContactRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string \| null | No | The billing email to set, or `null` to restore the default. |

## SetOtelConfigRequest

The telemetry configuration to set. `headers` defaults to empty, and an
unknown field is rejected with `400`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoint` | string | Yes | OTLP/HTTP endpoint (`https://…`; plaintext `http` only where the deployment allows insecure endpoints). |
| `headers` | map of string | No | Request headers sent to the endpoint, name → value. Values are write-only: no read returns them. |

## SetPlanRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan` | [PlanName](#planname) | Yes | The requested plan. |

## SetProjectBudgetRequest

`PUT /projects/{id}/budget` body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `monthly_limit_cents` | integer (int64) | Yes | The monthly budget, in US cents: an integer from `100` ($1.00) to `100000000000` ($1 billion). |

## SetRegistryRequest

Registry credentials. Passwords are encrypted at rest and are write-only.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | An optional user-facing description. |
| `kind` | string: `basic`, `ghcr`, `gcr`, `ecr`, `ecr_role` | No | The authentication kind. For `ecr_role`, the username is the role ARN and the password is ignored. |
| `password` | string | No | Registry password/token (max 64 KiB). Write-only — never echoed back by any public read endpoint. Required for every kind but `ecr_role`, which ignores it. |
| `username` | string | Yes | The registry username. |

## SetSandboxLabelsRequest

Request body for `PUT /sandboxes/{id}/labels`: the full replacement label set.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `labels` | map of string | No | The new label set. It replaces the current one, and `{}` clears all labels. |

## SetSandboxNetworkPolicyRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allow_cidrs` | array of string | No | IPv4 addresses and network-aligned CIDR ranges allowed by the policy. Host bits in a CIDR are rejected; bare IPv4 addresses are accepted. Duplicates are removed in input order. Defaults to an empty list. A non-empty list requires `block_all: true` or non-null `allow_domains`; otherwise it has no effect and is rejected with `400 BAD_REQUEST`. |
| `allow_domains` | array of string \| null | No | ASCII hostnames (at least two LDH labels) or leading `*.` wildcards, lowercased, with one trailing dot removed and duplicates removed in input order. Null means domain filtering is not configured; a non-null list implies `block_all: true` when that field is omitted or null. |
| `block_all` | boolean \| null | No | Default-deny toggle. With a non-null `allow_domains`, omitted or null normalizes to `true`, and an explicit `false` is rejected with `400 NETWORK_POLICY_DOMAINS_REQUIRE_BLOCK_ALL`. With `allow_domains` null, omitted or null normalizes to `false`. |

## SetSandboxPortRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `public` | boolean | Yes | Whether the port is accessible without a credential. |

## SetSandboxSecretsRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `secrets` | array of string | Yes | The complete desired set of project secret names. Required; send `[]` to detach every secret. |

## SetSecretRequest

A secret value and its metadata. Values are encrypted at rest and are
write-only.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allowed_domains` | array of string | No | Required per-secret egress scope: hostnames or `*.` wildcards, or `["*"]` for any verified host. Hostnames must be ASCII with at least two LDH labels (1..63 characters each, no leading/trailing hyphen; at most 253 characters total). IP literals and public-suffix wildcards are rejected. Entries are lowercased, one trailing dot is removed, and duplicates are removed in input order on create and update. Empty or omitted is rejected. Existing stored rows are not migrated. |
| `description` | string \| null | No | An optional user-facing description. |
| `value` | string | Yes | The secret value (max 64 KiB). Write-only — never echoed back. |

## SignSandboxFileUrlRequest

A request to sign a sandbox file URL.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) | Yes | Absolute expiry. Must lie in the future and at most the deployment's signed-URL ceiling ahead (7 days by default). |
| `method` | string | Yes | `GET` signs a download link (`/files/download`) and `POST` an upload link (`/files/upload`); no other method can be signed. |
| `path` | string | Yes | Sandbox file path the link addresses. The URL's `path` query parameter must match this string exactly. |

## SignedFileUrl

A signed sandbox file URL and the fields needed to recompose it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) | Yes | The expiry that was signed. |
| `method` | string | Yes | `GET` or `POST`, as signed. |
| `path` | string | Yes | The sandbox file path, as signed. |
| `signature` | string | Yes | The link's signature. Pass it back unchanged. |
| `url` | string | Yes | The full pre-signed file URL. |

## SignedPreviewUrl

A signed preview link.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) | Yes | When the link stops resolving (natural expiry), to the second. |
| `token` | string | Yes | The link's signed token, as it appears in `url`. |
| `url` | string | Yes | Host-based preview URL, `<scheme>://<port>-<token>.<domain>/` — the token stands in the hostname where the sandbox ID otherwise would. |

## Snapshot

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytes` | integer (int64) \| null | No | The disk size in bytes, or null until capture completes. |
| `class` | [SnapshotClass](#snapshotclass) | Yes | The sandbox class. |
| `created_at` | string (date-time) | Yes | When the snapshot was created. |
| `error` | string \| null | No | The failure detail, or null when capture has not failed. |
| `id` | string | Yes | The snapshot ID. |
| `kind` | [SnapshotKind](#snapshotkind) | Yes | The snapshot kind. A `full` snapshot captures memory and disk. |
| `memory_bytes` | integer (int64) \| null | No | The memory size in bytes, or null for snapshots without memory state. |
| `name` | string | Yes | The project-unique snapshot name. |
| `region_id` | string | Yes | The home region. |
| `region_ids` | array of string | Yes | Every region where the snapshot is available. |
| `sandbox_id` | string \| null | No | The ID of the sandbox the snapshot was captured from, or null when that sandbox no longer exists. |
| `status` | string | Yes | The snapshot status. |
| `updated_at` | string (date-time) | Yes | When the snapshot was last updated. |

## SnapshotKind

Type: string: `full`

## SnapshotPage

A page of snapshots.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | Opaque continuation token; `null` on the last page. |
| `snapshots` | array of [SnapshotListItem](#snapshotlistitem) | Yes | The snapshots in this page. |

## SnapshotSearchClass

The `class` filter of `GET /snapshots/search`.

Type: string: `linux`, `windows`, `gpu`

## SnapshotSearchPage

A page of matching snapshots.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | Continuation token for the next page; null on the last page. |
| `snapshots` | array of [SnapshotListItem](#snapshotlistitem) | Yes | Matching snapshots in this page. |
| `total` | integer (int64) | Yes | The number of matching snapshots. Exact when `total_relation` is `eq`, and a lower bound of 10000 when it is `gte`. |
| `total_relation` | [SearchTotalRelation](#searchtotalrelation) | Yes | Whether `total` is exact (`eq`) or a lower bound (`gte`). |

## SnapshotSearchSort

The `sort` values of `GET /snapshots/search`.

Type: string: `created_at`, `updated_at`, `name`, `bytes`

## SnapshotStatus

The capture status of a snapshot.

Type: string: `pending`, `building`, `ready`, `failed`

## SortOrder

Type: string: `asc`, `desc`

## SsoConnectionPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `connections` | array of [SsoConnection](#ssoconnection) | Yes | The organization's single sign-on connections. |
| `next_cursor` | string \| null | No | Opaque continuation token for the next page, or null on the last page. |

## SsoSetupLink

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | The setup URL, which expires five minutes after issuance. |

## TokenExchange

A platform access token.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `access_token` | string | Yes | Project- or organization-scoped access token. |
| `expires_in` | integer (int64) | Yes | Token lifetime in seconds (default 300). |
| `issued_token_type` | string | Yes | Always `urn:ietf:params:oauth:token-type:access_token`. |
| `token_type` | string | Yes | Always `Bearer`. |

## UpdateAuditConfigRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `disabled` | boolean | Yes | Whether to disable audit capture. |

## UpdateEphemeralLifecycleDefaults

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_timeout_seconds` | integer (int64) \| null | No | Idle time before cleanup in seconds, or null to disable it. |
| `timeout_seconds` | integer (int64) \| null | No | Maximum sandbox lifetime in seconds, or null to inherit it. |

## UpdateImageRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The permanent image name. |

## UpdateMacosSettingsRequest

The macOS settings to change: any non-empty subset of the fields.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `macos_auto_reserve` | boolean \| null | No | Whether a macOS create or start buys a Mac reservation when the organization has none in the region. |
| `macos_auto_reserve_max_reservations` | integer (int32) \| null | No | Maximum number of automatically created reservations. |

## UpdateMemberRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roles` | array of string | Yes | The member's complete new role set. Required, with at least one role. |

## UpdateOrganizationRegionRequest

The body of an organization-region update. An omitted field keeps its
value; `null` clears `toolbox_proxy_url` or `preview_domain`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string \| null | No | The new display name, 1 to 100 characters. |
| `preview_domain` | string \| null | No | The base domain of the region's preview URLs. Must be unique, must not be a public suffix such as `co.uk`, and must not be, or be inside, a domain the platform serves. |
| `toolbox_proxy_url` | string \| null | No | The base URL of the region's proxy. Must be an `https://` URL. |

## UpdateOrganizationRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_sandbox_timeout_seconds` | integer (int64) \| null | No | The longest timeout a sandbox in this organization may have, in seconds; null uses the plan maximum, or the platform maximum when there is no plan maximum. A value above that maximum is rejected. |
| `name` | string | No | The replacement organization name: at most 64 characters after trimming, with no control characters. |

## UpdateOrganizationRoleRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | The new role purpose. |
| `name` | string | No | The new role name. Whitespace is normalized as on create; the result must be 1 to 64 characters. |
| `organization_permissions` | array of string | No | The complete new set of organization permissions. |
| `project_permissions` | array of string | No | The complete new set of project permissions. |

## UpdatePreviewWarningRequest

Turns the preview warning page off or on. Unknown fields are rejected.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `disabled` | boolean | Yes | `true` turns the preview warning page off for every sandbox preview of the organization (needs the `preview_warning_opt_out` entitlement where enforcement is on); `false` turns it back on. |

## UpdateProjectApiKeyRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sync_to_v0` | boolean | No | Whether the v0 ↔ v2 key sync keeps a copy of this key on Daytona v0. `false` deletes the Daytona v0 copy (the key keeps working here); `true` copies the key to Daytona v0 again. A Daytona v0 copy can read every sandbox, snapshot and registry of the organization on Daytona v0, which has no read permissions. Only a key a person minted in the organization's `default` project is ever copied; a key imported from Daytona v0 always is. Required. |

## UpdateProjectLifecyclePolicyRequest

A `PATCH` at block granularity: an absent block is kept, `null` clears it,
and an object replaces the whole block (a field missing inside it is
unset). Blocks never merge field by field, so each block is validated on
its own.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ephemeral` | null \| [UpdateEphemeralLifecycleDefaults](#updateephemerallifecycledefaults) | No | Replacement defaults for ephemeral sandboxes; null clears the block. |

## UpdateProjectLimitsRequest

The limits to change. Each one is optional: a missing limit keeps the
stored value, `null` removes it, and an integer sets it. Unknown fields
are refused.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_concurrent_vms` | integer (int64) \| null | No | The most sandboxes the project may run at once, or null for no project limit. |
| `max_persistent_vms` | integer (int64) \| null | No | The most persistent sandboxes the project may have, or null for no project limit. |
| `max_total_vms` | integer (int64) \| null | No | The most sandboxes the project may have, resting ones included, or null for no project limit. |

## UpdateProjectRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The new project name: at most 64 characters after trimming, with no control characters. `default` is reserved. |

## UpdateReservationRequest

PATCH /reservations/{id} body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean | Yes | Renew the reservation near each period end while a macOS sandbox is active on it; off lets it lapse at `period_end`. |

## UpdateSandboxLifecyclePolicyRequest

Sandbox lifecycle settings accepted during creation and lifecycle updates.
Unknown fields return 400 instead of being ignored.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_expiry_seconds` | integer (int64) \| null | No | Idle seconds before the idle action runs. A value below 60 is raised to 60; use `-1` to clear the idle expiry. |
| `on_idle_timeout` | null \| [LifecycleAction](#lifecycleaction) | No | Action to run when the idle expiry elapses. |
| `on_timeout` | null \| [LifecycleAction](#lifecycleaction) | No | Action to run when the timeout expires. |
| `timeout_seconds` | integer (int64) \| null | No | Seconds before the timeout action runs. Supplying a value restarts the countdown. |

## UpdateServiceAccountRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | The replacement description; `null` clears it. |
| `name` | string \| null | No | The replacement name. |
| `roles` | array of string \| null | No | The replacement role identifiers. |

## UsagePeriodPage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The next page cursor, or `null` at the end. |
| `usage_periods` | array of [BillingUsagePeriod](#billingusageperiod) | Yes | The usage periods in this page, newest first. |

## UsageReport

Project usage over a time range.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `available` | boolean | Yes | Whether usage reporting is available. |
| `end_at` | string (date-time) \| null | No | End of the reported time range, exclusive. |
| `items` | array of [UsageReportEntry](#usagereportentry) | Yes | Usage grouped by sandbox and interval. |
| `resolution` | null \| [UsageReportResolution](#usagereportresolution) | No | Effective bucket size. Omitted when usage reporting is unavailable. |
| `start_at` | string (date-time) \| null | No | Start of the reported time range, inclusive. |

## User

The signed-in user.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | The user's email address. |
| `id` | string (uuid) | Yes | The user ID. |
| `name` | string \| null | No | The user's display name, when set. |

## V0MigrationSummary

Response of `GET /migration/v0/summary`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_keys` | integer (int64) | Yes | Live API keys of the organization's `default` project. Keys synced from Daytona v0 work on both platforms unchanged. |
| `from_v0` | boolean | Yes | The organization was imported from Daytona v0 (it carries the Daytona v0 organization id it came from). Personal organizations included. |
| `images_converted` | integer (int64) | Yes | Named images registered from Daytona v0 snapshots that are at the current image format. |
| `images_to_convert` | integer (int64) | Yes | Named images registered from Daytona v0 snapshots that are still below the current image format (`format_outdated`): not converted yet, converting, or a failed conversion (retried on the next use). Each converts on its first Linux sandbox create, or ahead of time with `POST /images/{id}/convert`. |
| `personal` | boolean | Yes | The organization is a personal organization. |
| `registries` | integer (int64) | Yes | Container registries of the `default` project. |
| `sandboxes_imported` | integer (int64) | Yes | Archived Daytona v0 sandboxes imported into the `default` project. |

## V0SandboxImport

The result of importing a Daytona v0 sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `existing` | boolean | Yes | True when this call returned an earlier import instead of creating a sandbox. |
| `image_id` | string | Yes | The imported sandbox’s image (`img_…`). The sandbox waits for its image to be ready before starting. |
| `sandbox_id` | string | Yes | The imported sandbox ID. |
| `secret_env_vars` | array of string | Yes | Env variable names whose value on Daytona v0 is a sandbox secret. Daytona v0 never hands the value over, so the imported sandbox starts without them: set them on it. Empty when the call returned an existing import. |
| `status` | string | Yes | The sandbox’s status. A fresh import remains `queued` until its image is ready. |
| `v0_labeled` | boolean | Yes | Whether Daytona v0 confirmed the `daytona.io/migrated-to` label on the original sandbox. False means the label could not be set now; the import itself succeeded, and repeating the call retries the label. |
| `warnings` | array of string | Yes | Settings and values that could not be imported. |

## V0SandboxPage

`GET /migration/v0/sandboxes` response: one page.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | Opaque token for the next page — pass it as `?cursor=`; `null` on the last page. A page can be shorter than `limit` without being the last: only a `null` ends the walk. |
| `sandboxes` | array of [V0Sandbox](#v0sandbox) | Yes | The Daytona v0 sandboxes in this page. |

## Volume

A volume available to the project.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the volume was created. |
| `error` | string \| null | No | The failure detail, or null when the volume has not failed. |
| `id` | string | Yes | The volume ID. |
| `imported_from` | [ImportedFrom](#importedfrom) | No | The source platform and resource ID when this volume was imported. |
| `last_used_at` | string (date-time) \| null | No | When the volume was last attached, or null when it has not been used. |
| `name` | string | Yes | The project-unique volume name. |
| `options` | object | No | Type-specific options. Disk volumes use an empty object; bucket volumes include their bucket settings and credential secret names. |
| `size_gib` | integer (int32) \| null | No | Scratch capacity in GiB. Disk volumes only — a bucket volume has no capacity of its own and reports `null`. |
| `status` | [VolumeStatus](#volumestatus) | Yes | The volume status. |
| `type` | [VolumeType](#volumetype) | Yes | The volume type. |
| `updated_at` | string (date-time) | Yes | When the volume metadata last changed. |
| `used_bytes` | integer (int64) \| null | No | Logical file usage in bytes, or null before the first usage report. |
| `used_bytes_at` | string (date-time) \| null | No | When `used_bytes` was observed, or null when usage is unknown. |

## VolumeMount

A volume attachment as requested on `POST /sandboxes`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mount_path` | string | Yes | The absolute path inside the sandbox, with no `..`. It is normalized (repeated slashes, `.` components and a trailing slash removed) and may not be `/` or be on or beneath a system directory: `/bin`, `/boot`, `/dev`, `/etc`, `/lib`, `/lib32`, `/lib64`, `/mnt/scratch`, `/overlay`, `/proc`, `/sbin`, `/sys` or `/usr`. It may not be equal to or beneath another mount's `mount_path`. |
| `read_only` | boolean \| null | No | Mount without write access. Supported only for bucket volumes. |
| `subpath` | string \| null | No | Mount only this subtree: a subdirectory for a disk volume, a key prefix under the volume's own prefix for a bucket volume. A relative path with no empty or `..` segments and no control characters. |
| `volume` | string | Yes | The volume name or a `vol_` id. |

## VolumePage

Response envelope for `GET /volumes`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `next_cursor` | string \| null | No | The opaque continuation token, or null on the last page. |
| `volumes` | array of [Volume](#volume) | Yes | The volumes in this page. |

## VolumeType

Type: string: `disk`, `bucket`

## Wallet

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `automatic_top_up` | [AutomaticTopUp](#automatictopup) | Yes | The automatic top-up setting, including its unset state. |
| `balance_cents` | integer (int64) | Yes | The total available balance in cents. |
| `billing_type` | [BillingType](#billingtype) | Yes | The organization's billing arrangement. |
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `free_credits_balance_cents` | integer (int64) | Yes | The promotional-credit balance in cents. |
| `paid_credits_balance_cents` | integer (int64) | Yes | The purchased-credit balance in cents. |
| `total_amount_due_this_month_cents` | integer (int64) | Yes | The amount due in the current month, in cents. |
| `total_spent_this_month_cents` | integer (int64) | Yes | The amount spent in the current month, in cents. |

## AuditActionGroup

Actions the audit log can record against one target type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actions` | array of string | Yes | Actions that can appear against this target type, sorted alphabetically. |
| `target_type` | string | Yes | The resource type the actions apply to. It matches `target_type` on an audit log entry. |

## AuditLogEntry

An organization audit log entry.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | The action name. |
| `actor_created_by` | string (uuid) \| null | No | The user who created the actor key, or `null` when unavailable or hidden. |
| `actor_email` | string \| null | No | The actor's email address, or `null`. |
| `actor_key_id` | string (uuid) \| null | No | The actor's key ID, or `null`. |
| `actor_key_prefix` | string \| null | No | The actor key prefix, or `null`. |
| `actor_kind` | string | Yes | The actor type. |
| `actor_partner` | string \| null | No | The partner application that authenticated the actor, or `null`. |
| `actor_service_account_id` | string (uuid) \| null | No | The actor's service account ID, or `null`. |
| `actor_user_id` | string (uuid) \| null | No | The actor's user ID, or `null`. |
| `created_at` | string (date-time) | Yes | When the action occurred. |
| `error_message` | string \| null | No | The failure message, or `null` for a successful action. |
| `id` | string (uuid) | Yes | The audit log entry ID. |
| `ip_address` | string \| null | No | The request IP address, or `null`. |
| `metadata` | object \| null | No | Additional action details, or `null`. |
| `org_id` | string (uuid) | Yes | The organization ID. |
| `project_id` | string (uuid) \| null | No | The project ID, or `null` when the action is organization-wide. |
| `status_code` | integer (int32) | Yes | The response status code. |
| `target_id` | string \| null | No | The target resource ID, or `null`. |
| `target_type` | string | Yes | The target resource type. |
| `user_agent` | string \| null | No | The request user agent, or `null`. |

## Balance

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applicable_to` | null \| [BalanceApplicableTo](#balanceapplicableto) | No | Product restrictions, or `null` when unrestricted. |
| `balance_cents` | integer (int64) | Yes | The remaining balance in cents. |
| `created_at` | string (date-time) | Yes | When the balance was created. |
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `expires_at` | string (date-time) \| null | No | When the balance expires, or `null` when it does not expire. |
| `granted_amount_cents` | integer (int64) | Yes | The amount originally granted, in cents. |
| `id` | string | Yes | The balance ID. |
| `name` | string | Yes | The balance display name. |
| `type` | [BalanceType](#balancetype) | Yes | The balance type. |

## BillingPeriod

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `end_at` | string (date-time) | Yes | The end of the billing period. |
| `start_at` | string (date-time) | Yes | The beginning of the billing period. |

## PendingPlanChange

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `effective_at` | string (date-time) | Yes | When the scheduled plan takes effect. |
| `plan` | [PlanName](#planname) | Yes | The scheduled plan. |

## PlanLimits

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_concurrent_sandboxes` | integer (int64) \| null | No | The concurrent sandbox limit, or `null` when unlimited. |
| `max_mac_reservations` | integer (int64) | No | The most Mac reservations the organization can hold at once. |
| `max_members` | integer (int64) \| null | No | The member limit, or `null` when unlimited. |
| `max_sandbox_cores` | number (double) \| null | No | The CPU limit of one Linux sandbox in cores (1 core = 2 vCPUs), or `null` when only the platform maximum applies. |
| `max_sandbox_memory_mib` | integer (int64) \| null | No | The memory limit of one Linux sandbox in MiB, or `null` when only the platform maximum applies. |
| `max_sandbox_timeout_seconds` | integer (int64) \| null | No | The longest timeout a sandbox may have on this plan, in seconds, or `null` when the plan sets no maximum. |

## BillingAddress

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `city` | string | Yes | The city or locality. |
| `country` | string | Yes | The two-letter country code. |
| `line1` | string | Yes | The first street-address line. |
| `line2` | string | Yes | The second street-address line. |
| `postal_code` | string | Yes | The postal code. |
| `state` | string | Yes | The state, province, or region. |

## BillingTaxId

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | [BillingTaxIdType](#billingtaxidtype) | Yes | The tax identifier type. |
| `value` | string | Yes | The tax identifier value. |

## BucketCredentials

Secret names used to access an external bucket.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `access_key_secret` | string | Yes | The project secret containing the access key. |
| `secret_key_secret` | string | Yes | The project secret containing the secret key. |

## ExternalBucketOrigin

Type: string: `external`

## BuildContextUploadPart

One part of a build-context upload.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytes` | integer (int64) | Yes | The exact size of the part's body in bytes. |
| `part_number` | integer (int32) | Yes | The part's 1-based number. Part `n` holds the archive bytes from `(n - 1) * part_size` on. |
| `url` | string | Yes | A presigned URL that accepts one `PUT` of exactly `bytes` bytes until `urls_expire_at`. It is a credential: do not log or share it. |

## BuildContextUploadState

The state of a build-context upload.

Type: string: `uploading`, `ready`

## Charge

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount_cents` | integer (int64) | Yes | The charged amount in cents. |
| `created_at` | string (date-time) | Yes | When the charge was created. |
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `description` | string | Yes | The charge description. |
| `failure_message` | string \| null | No | The payment failure detail, or `null` when no failure occurred. |
| `has_invoice` | boolean | Yes | Whether an invoice is attached. |
| `has_pdf` | boolean | Yes | Whether a downloadable PDF receipt is available. |
| `id` | string | Yes | The charge ID. |
| `invoice_url` | string \| null | No | The hosted invoice URL, or `null` when unavailable. |
| `receipt_url` | string \| null | No | The hosted receipt URL, or `null` when unavailable. |
| `status` | [ChargeStatus](#chargestatus) | Yes | The charge status. |

## AnalyticsConfig

Browser analytics configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_key` | string | Yes | Public browser analytics key. |
| `environment` | string | Yes | Environment tag the browser stamps on its events. |
| `host` | string | Yes | Ingestion host the browser talks to. |

## OidcPublicConfig

OpenID Connect login settings.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audience` | string \| null | No | The API identifier requested during login. Present with the `oidc` provider; null with `workos`. |
| `cli_client_id` | string \| null | No | Public OAuth client ID for native clients. `null` when unavailable. |
| `client_id` | string | Yes | The dashboard's public OAuth client ID. |
| `issuer` | string | Yes | The issuer the API validates user tokens against. |
| `provider` | [OidcProvider](#oidcprovider) | Yes | Login provider used by the dashboard. |
| `scope` | string | Yes | Default authorization scope requested during login. |

## SshGatewayConfig

SSH connection settings.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `host` | string | Yes | SSH gateway host. |
| `port` | integer (int32) | Yes | SSH gateway port. |

## CpuArchAvailability

Availability of one CPU architecture across the covered regions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `available` | boolean | Yes | Whether the architecture is available in at least one included region. |
| `id` | [CpuArchitecture](#cpuarchitecture) | Yes | CPU architecture. |
| `region_ids` | array of string | Yes | Included regions where this architecture is available. |

## CpuCatalogRegion

CPU defaults for one included region.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `default_arch` | [CpuArchitecture](#cpuarchitecture) | Yes | Default CPU architecture for an unhinted create. |
| `default_type` | string \| null | No | Default CPU type for an unhinted create, when configured. |
| `id` | string | Yes | Region identifier. |

## CpuType

A CPU type from the platform catalog with its availability across the
covered regions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `available` | boolean | Yes | Whether the CPU type is available in at least one included region. |
| `cpu_arch` | [CpuArchitecture](#cpuarchitecture) | Yes | CPU architecture. |
| `exact_region_ids` | array of string | Yes | Included regions that offer this CPU type directly. |
| `fallback_region_ids` | array of string | Yes | Included regions that can satisfy this CPU type with compatible hardware. |
| `id` | string | Yes | CPU type identifier accepted by sandbox create requests. |
| `name` | string | Yes | Display name. |
| `tier` | integer (int32) | Yes | Relative performance rank within the architecture; higher is faster. |

## ApiErrorCode

Stable machine-readable error codes, returned as `ErrorBody.code`
when `source` is `DAYTONA_API`.

Type: string: `ORG_SUSPENDED`, `SANDBOX_ABUSE_HOLD`, `PROJECT_BUDGET_EXCEEDED`, `FEATURE_NOT_ENABLED`, `ENTITLEMENT_REQUIRED`, `EMAIL_ACCESS_DENIED`, `GPU_ACCESS_UNDER_REVIEW`, `SIGNUP_NOT_INVITED`, `USER_SUSPENDED`, `OVERLOADED`, `RATE_LIMITED`, `LIMIT_EXCEEDED`, `IMAGE_TOO_LARGE`, `SNAPSHOT_TOO_LARGE`, `IF_MATCH_REQUIRED`, `STALE_SECRETS_REVISION`, `SECRETS_TRANSITION_IN_PROGRESS`, `STALE_NETWORK_POLICY_REVISION`, `SECRET_ALREADY_EXISTS`, `NETWORK_POLICY_DOMAINS_REQUIRE_BLOCK_ALL`, `NETWORK_POLICY_TRANSITION_IN_PROGRESS`, `BILLING_DISABLED`, `BILLING_UNREACHABLE`, `BILLING_UNAVAILABLE`, `BILLING_NOT_PROVISIONED`, `CHARGE_NOT_FOUND`, `INVOICE_NOT_FOUND`, `COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_LIMIT_REACHED`, `COUPON_ALREADY_REDEEMED`, `INVOICE_NOT_FINALIZED`, `INVOICE_NOT_PAYABLE`, `CHARGE_NOT_SUCCEEDED`, `PLAN_UNCHANGED`, `PLAN_CHANGE_PENDING`, `PLAN_MANAGED_BY_OPERATOR`, `PAYMENT_METHOD_REQUIRED`, `BILLING_ACCOUNT_CONFLICT`, `UNKNOWN_PLAN`, `PLAN_REQUIRES_SALES`, `AUTOMATIC_TOP_UP_NOT_AVAILABLE`, `SEARCH_NOT_CONFIGURED`, `SEARCH_UNAVAILABLE`, `UNSUPPORTED_VOLUME_TYPE`, `BUCKET_CREATE_FAILED`, `BUCKET_DELETE_FAILED`, `BUCKET_NOT_EMPTY`, `ORIGIN_IMPORT_ONLY`, `READ_ONLY_UNSUPPORTED`, `WORKLOAD_PLANE_ELSEWHERE`, `MANAGEMENT_PLANE_ELSEWHERE`, `NOT_SUPPORTED_FOR_CLASS`, `INVALID_FOR_SOURCE`, `ROLE_IN_USE`, `MEMBERSHIP_EDITS_FROZEN`, `USAGE_UNAVAILABLE`, `BAD_RANGE`, `BAD_RESOLUTION`, `BILLING_FORBIDDEN`, `BILLING_ERROR`, `PLACEMENT_UNAVAILABLE`, `REGION_UNAVAILABLE`, `SOURCE_AMBIGUOUS`, `CREATE_BODY_TOO_LARGE`, `NO_ACTIVE_RESERVATION`, `NO_FREE_SLOT`, `RESERVATION_NOT_FOUND`, `NO_MAC_AVAILABLE`, `MAC_DISK_FULL`, `DISK_NOT_READY`, `AUTO_RESERVE_LIMIT_REACHED`, `IDEMPOTENCY_KEY_REUSED`, `INSUFFICIENT_BALANCE`, `CHARGE_FAILED`, `ECR_CREDENTIALS_INVALID`, `ECR_ACCOUNT_MISMATCH`, `ECR_OWNERSHIP_UNVERIFIABLE`, `IMAGE_NOT_FOUND`, `IMAGE_NOT_READY`, `IMAGE_BUILD_FAILED`, `DEFAULT_IMAGE_NOT_CONFIGURED`, `IMAGE_FORMAT_OUTDATED`, `IMAGE_CLASS_MISMATCH`, `IMAGE_NAME_TAKEN`, `IMAGE_NAME_RESERVED`, `IDLE_OUT_OF_RANGE`, `CREATE_TTL_OUT_OF_RANGE`, `SNAPSHOT_NOT_FOUND`, `SNAPSHOT_NOT_READY`, `SNAPSHOT_CLASS_MISMATCH`, `SNAPSHOT_IN_PROGRESS`, `IMPORTED_KEY_ALWAYS_SYNCED`, `KEY_SYNC_NOT_APPLICABLE`, `V0_BRIDGE_UNAVAILABLE`, `V0_SANDBOX_NOT_FOUND`, `V0_SANDBOX_NOT_IMPORTABLE`, `V0_BACKUP_REGISTRY_UNCONFIGURED`, `V0_MIGRATION_DEFAULT_PROJECT_ONLY`, `INVALID_PARENT_REGION`, `INVALID_SANDBOX_CIDR`, `INVALID_PREVIEW_DOMAIN`, `INVALID_TOOLBOX_PROXY_URL`, `REGION_NOT_FOUND`, `REGION_LIMIT_REACHED`, `REGION_NOT_EMPTY`, `REGION_SUBNETS_EXHAUSTED`, `RUNNER_HAS_SANDBOXES`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `PAYMENT_REQUIRED`, `METHOD_NOT_ALLOWED`, `REQUEST_TIMEOUT`, `CONFLICT`, `GONE`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `UNPROCESSABLE_ENTITY`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE`, `NOT_IMPLEMENTED`, `BAD_GATEWAY`, `GATEWAY_TIMEOUT`, `INTERNAL_SERVER_ERROR`

## ImageRetention

Type: string: `permanent`, `idle`

## ImageSourceValue

Type: object \| object \| object \| object

## ImportedFrom

The source platform and resource ID of an imported resource.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The resource's ID on the source platform. |
| `platform` | string | Yes | The source platform. `v0` (Daytona v0) is the only value. |

## ImageListItem

An image with its pagination cursor.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `anonymous` | boolean | Yes | Whether the image has no permanent name. |
| `bytes` | integer (int64) \| null | No | The image size in bytes, or null until the build completes. |
| `class` | string | Yes | The sandbox class supported by the image. |
| `created_at` | string (date-time) | Yes | When the image was created. |
| `cursor` | string | Yes | Opaque continuation token for the next image in the list. |
| `default` | boolean | Yes | Whether this is the image a sandbox create without `image` boots. |
| `deprecated` | boolean | Yes | Whether this platform image is deprecated. A deprecated image is not listed and cannot be used by name, but its ID still resolves. |
| `disk_mib` | integer (int64) \| null | No | The disk size in MiB that a macOS sandbox created from this image gets when the create omits `disk_mib`; a create cannot ask for less. Set for images captured from a macOS sandbox; null for other images. |
| `error` | string \| null | No | Build failure reason; null unless `status` is `failed`. |
| `expires_at` | string (date-time) \| null | No | When an anonymous image expires, or null for a permanent image. |
| `format_outdated` | boolean | Yes | `format_version` is below the current format. Such an image converts on its first Linux sandbox create (which waits `queued` meanwhile) or ahead of time with `POST /images/{id}/convert`; other operations refuse it with `IMAGE_FORMAT_OUTDATED` until then. |
| `format_version` | integer (int32) | Yes | Image format version: `1` for images imported from Daytona v0, `2` for the current format. See `status` for image readiness. |
| `id` | string | Yes | The image ID. |
| `imported_from` | [ImportedFrom](#importedfrom) | No | The source platform and resource ID when this image was imported. |
| `layer_count` | integer (int32) \| null | No | The number of filesystem layers, or null until the build completes. |
| `name` | string \| null | No | The image name, or null for an anonymous image. |
| `origin` | string | Yes | How the image was created. |
| `platform` | boolean | Yes | Whether the platform publishes this image for every project. A project's own image with the same name takes precedence for that project, and platform images cannot be renamed, converted, or deleted. |
| `region_id` | string | Yes | The home region. |
| `region_ids` | array of string | Yes | Every region where the image is available. |
| `retention` | [ImageRetention](#imageretention) | Yes | The retention policy: `permanent` or `idle`. |
| `source` | null \| [ImageSourceValue](#imagesourcevalue) | No | The image source. |
| `status` | string | Yes | The build status. |
| `updated_at` | string (date-time) | Yes | When the image was last updated. |

## SearchTotalRelation

Type: string: `eq`, `gte`

## Invitation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the invitation was created or last re-issued. |
| `declined_at` | string (date-time) \| null | No | When the invitation was declined, or `null`. |
| `email` | string | Yes | The invited email address. |
| `expires_at` | string (date-time) | Yes | When the invitation expires. |
| `id` | string (uuid) | Yes | The invitation ID. |
| `org_id` | string (uuid) | Yes | The organization ID. |
| `roles` | array of string | Yes | The role identifiers granted on acceptance. |
| `status` | [InvitationStatus](#invitationstatus) | Yes | The invitation status. |

## Invoice

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `file_url` | string | Yes | The hosted invoice URL. |
| `has_pdf` | boolean | Yes | Whether a downloadable PDF is available. |
| `id` | string | Yes | The invoice ID. |
| `issued_at` | string (date-time) \| null | No | When the invoice was issued. |
| `number` | string | Yes | The human-readable invoice number. |
| `payment_due_at` | string (date-time) \| null | No | When payment is due. |
| `payment_overdue` | boolean | Yes | Whether payment is overdue. |
| `payment_status` | [InvoicePaymentStatus](#invoicepaymentstatus) | Yes | The payment status. |
| `status` | [InvoiceStatus](#invoicestatus) | Yes | The invoice status. |
| `subtotal_amount_cents` | integer (int64) | Yes | The subtotal in cents. |
| `suspends_at` | string (date-time) \| null | No | When nonpayment will suspend the organization, or `null` when not scheduled. |
| `taxes_amount_cents` | integer (int64) | Yes | The tax amount in cents. |
| `total_amount_cents` | integer (int64) | Yes | The total in cents. |
| `total_due_amount_cents` | integer (int64) | Yes | The unpaid amount in cents. |
| `type` | [InvoiceType](#invoicetype) | Yes | The invoice type. |

## MacCatalogRegion

One covered region.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `default_model` | string | Yes | The model a purchase that names none reserves. |
| `id` | string | Yes | The region ID. |
| `models` | array of [MacCatalogModel](#maccatalogmodel) | Yes | One entry per Mac model, in `GET /mac-models` order. |

## MacModel

A Mac model.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cores` | integer (int32) | Yes | CPU cores in the Mac. A Mac core is one CPU (Apple Silicon has no SMT). |
| `default_size` | null \| [MacResources](#macresources) | Yes | The default size: the cores, memory and disk that a create gives each size field it omits. A create from a captured image gets the image's disk size instead. Null when this Mac model takes no sandbox. |
| `disk_mib` | integer (int32) | Yes | Size of the Mac's SSD in MiB. Sandboxes use the disk space in `sandbox_disk_mib`. |
| `id` | string | Yes | Mac model slug accepted by POST /reservations. |
| `max_sandboxes` | integer (int32) | Yes | Most sandboxes on one Mac of this model at once. Stopped sandboxes do not count. The sizes of the sandboxes on one Mac must fit that Mac. 0 when this Mac model takes no sandbox. |
| `memory_mib` | integer (int32) | Yes | Physical memory in MiB. |
| `name` | string | Yes | Display name of the Mac model. |
| `sandbox_disk_mib` | integer (int32) | Yes | Disk space for sandboxes on one Mac of this model, in MiB. The disks and disk volumes of the sandboxes on one Mac must fit in it. 0 until this Mac model's disk space is known. |

## MacReservationEndReason

Type: string: `expired`, `released`, `charge_failed`, `not_accepted`, `reissued`, `operator`

## MacReservationOrigin

Type: string: `explicit`, `auto`

## MacReservationStatus

Type: string: `pending_charge`, `pending_mac`, `active`, `ending`, `released`, `failed`

## MacResources

CPU cores, memory and disk, in cores and MiB.
A Mac core is one CPU of the Mac (Apple Silicon has no SMT).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cores` | integer (int32) | Yes | CPU cores. |
| `disk_mib` | integer (int32) | Yes | Sandbox disk in MiB. |
| `memory_mib` | integer (int32) | Yes | Memory in MiB. |

## MsaCommit

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `committed_cents` | integer (int64) | Yes | The committed amount in cents. For a commit released in installments, the installments available now; otherwise the whole commitment. |
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `expires_at` | string (date-time) \| null | No | When the commit expires, or `null` when it does not expire. |
| `expiring_soon` | boolean | Yes | Whether the active commit expires within 30 days and no other commit under the MSA continues coverage after it. |
| `id` | string | Yes | The commit ID. |
| `low_balance` | boolean | Yes | Whether at most 20% of the active commit's committed amount remains. |
| `name` | string | Yes | The commit display name, which falls back to the product name. |
| `product_name` | string | Yes | The name of the product the commit was sold as. |
| `remaining_cents` | integer (int64) | Yes | The amount of the commitment not yet used, in cents. |
| `scheduled_cents` | integer (int64) | Yes | The whole commitment in cents, across every installment. Equals `committed_cents` unless the commit is released in installments. |
| `starts_at` | string (date-time) | Yes | When the commit starts. |
| `status` | [MsaStatus](#msastatus) | Yes | The commit status: `upcoming` before `starts_at`, `expired` from `expires_at` on, and `active` in between. |
| `type` | [MsaCommitType](#msacommittype) | Yes | Whether the commitment is paid up front or invoiced at the end. |
| `used_cents` | integer (int64) | Yes | The amount of the commitment already used, in cents. |

## MsaDiscount

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ends_at` | string (date-time) \| null | No | When the discount ends, or `null` when it does not end. |
| `id` | string | Yes | The discount ID: the rate override ID, suffixed with `:<n>` when one override has several scopes (each listed as its own discount). |
| `multiplier` | number (double) \| null | No | The factor applied to the list price for a `multiplier` discount, or `null` for other types. |
| `overwrite_cents_per_unit` | number (double) \| null | No | The replacement price for an `overwrite` discount with a flat rate, in cents per product unit, which can be fractional, or `null` for other types and for tiered or percentage overwrites. |
| `pricing_group_values` | map of string | Yes | The pricing dimension values the discount is limited to, by dimension name; empty when it applies to every value. |
| `product_names` | array of string | Yes | The names of the products the discount applies to; empty with empty `product_tags` when it applies to every product. |
| `product_tags` | array of string | Yes | The product tags the discount applies to; empty with empty `product_names` when it applies to every product. |
| `starts_at` | string (date-time) | Yes | When the discount starts. |
| `status` | [MsaStatus](#msastatus) | Yes | The discount status: `upcoming` before `starts_at`, `expired` from `ends_at` on, and `active` in between. |
| `type` | [MsaDiscountType](#msadiscounttype) | Yes | How the discount changes the price: a multiplier on the list price, a replacement price, or replacement price tiers. |

## NetworkPolicyRules

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allow_cidrs` | array of string | Yes | IPv4 addresses and CIDR ranges allowed by the policy. |
| `allow_domains` | array of string \| null | No | Domain names allowed by the policy, or null when domain filtering is not configured. |
| `block_all` | boolean | Yes | Whether traffic is denied unless an allow rule matches. |
| `version` | integer (int32) | Yes | Policy format version. |

## ImageBuildLimits

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `concurrent` | [UsageLimit](#usagelimit) | Yes | The concurrent image-build limit and current usage. |

## MemberLimits

Type: [UsageLimit](#usagelimit) & object

## SandboxLimits

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `concurrent` | [UsageLimit](#usagelimit) | Yes | The concurrent sandbox limit and current usage. |
| `total` | [UsageLimit](#usagelimit) | Yes | The total sandbox limit and current usage. |

## SandboxResourceLimits

The largest resources one Linux sandbox may be created with: the
organization's plan cap, bounded by the platform maximum.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_cores` | number (double) | Yes | The maximum `cores_max` of one sandbox, in cores (1 core = 2 vCPUs). |
| `max_memory_mib` | integer (int64) | Yes | The maximum `memory_max_mib` of one sandbox, in MiB. |

## SandboxTimeoutLimits

The longest sandbox timeout the organization allows now, and how high its own cap may go.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ceiling_seconds` | integer (int64) | Yes | The highest value the organization's own cap may be set to, in seconds: the plan maximum, or the platform maximum when there is no plan maximum. |
| `max_seconds` | integer (int64) | Yes | The longest `timeout_seconds` a sandbox may have now, in seconds: the organization's own cap, bounded by the plan maximum. |

## StorageLimits

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `images` | [UsageLimit](#usagelimit) | Yes | The image limit and current usage. Captured, built, and imported images count; failed images do not. |
| `snapshots` | [UsageLimit](#usagelimit) | Yes | The snapshot limit and current usage. Failed snapshots do not count. |
| `volumes` | [UsageLimit](#usagelimit) | Yes | The volume limit and current usage. Deleted volumes do not count. |

## UsageLimit

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | integer (int64) \| null | Yes | The effective cap; `null` means no limit. A ceiling, not a reservation: reaching it refuses new work, but nothing is set aside. |
| `usage` | integer (int64) | Yes | The current usage counted against the limit. |

## OrganizationListItem

An organization together with the signed-in user's membership.

Type: [Organization](#organization) & object

## RegionStatus

Type: string: `active`, `disabled`

## OrganizationRoleKind

Whether a role is part of the platform catalog or defined by the
organization. The server may add kinds later.

Type: string: `built_in`, `custom`

## OrganizationRunnerAdminState

Whether a runner accepts new sandboxes.

Type: string: `active`, `cordoned`

## OrganizationRunnerStatus

Whether a runner is connected.

Type: string: `online`, `offline`, `lost`

## ParentRegion

A parent region the organization may create a region under.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The parent region ID, for `parent_region_id`. |
| `name` | string | Yes | The display name. |

## PaymentMethod

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand` | [PaymentMethodBrand](#paymentmethodbrand) | Yes | The payment-card brand. |
| `exp_month` | integer (int32) | Yes | The card's expiration month. |
| `exp_year` | integer (int32) | Yes | The card's expiration year. |
| `id` | string | Yes | The payment method ID. |
| `is_default` | boolean | Yes | Whether this is the default payment method. |
| `last4` | string | Yes | The final four digits of the card number. |

## Permission

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | Yes | The display category. |
| `id` | string | Yes | The permission identifier. |
| `name` | string | Yes | The display name. |

## Plan

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `entitlements` | array of string | Yes | The entitlement keys included in the plan. |
| `fee_cents` | integer (int64) | Yes | The recurring plan fee in cents. |
| `limits` | [PlanLimits](#planlimits) | Yes | The plan limits. |
| `monthly_credit_cents` | integer (int64) | Yes | The monthly included credit in cents. |
| `plan` | [PlanName](#planname) | Yes | The catalog plan. |
| `self_serve` | boolean | Yes | Whether members can select this plan through the API. |

## EffectiveLifecyclePolicies

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `linux` | [EffectiveLinuxLifecyclePolicies](#effectivelinuxlifecyclepolicies) | Yes | Effective Linux sandbox policies. |
| `macos` | [EffectiveMacosLifecyclePolicies](#effectivemacoslifecyclepolicies) | Yes | A macOS create does not take the project's lifecycle defaults, so this block always shows the platform defaults. |

## ProjectLifecycleDefaults

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ephemeral` | [EphemeralLifecycleDefaults](#ephemerallifecycledefaults) | Yes | Defaults for ephemeral sandboxes. |

## ProjectSandboxLimits

The three sandbox counts a project can be limited on, each with its
limit and current usage.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `concurrent` | [UsageLimit](#usagelimit) | Yes | The project's concurrent sandbox limit and current usage. |
| `persistent` | [UsageLimit](#usagelimit) | Yes | The project's persistent sandbox limit and current usage. Stopped and paused persistent sandboxes count. |
| `total` | [UsageLimit](#usagelimit) | Yes | The project's total sandbox limit and current usage. |

## ProjectMember

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `added_at` | string (date-time) \| null | No | When the member was added, or `null` for an implicit membership. |
| `email` | string | Yes | The member's email address. |
| `implicit` | boolean | Yes | Whether every organization member receives this membership automatically. |
| `name` | string \| null | No | The member's display name, or `null` when unavailable. |
| `user_id` | string (uuid) | Yes | The member's user ID. |

## ProjectServiceAccount

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `added_at` | string (date-time) \| null | No | When project access was added, or `null` for implicit access. |
| `archived_at` | string (date-time) \| null | No | When the service account was archived, or `null` while active. |
| `id` | string (uuid) | Yes | The service account ID. |
| `implicit` | boolean | Yes | Whether every service account receives this project access automatically. |
| `name` | string | Yes | The service account name. |

## Region

A region that can be named in a create.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_base_url` | string \| null | No | API base URL when this region publishes one. |
| `available` | boolean | Yes | Whether this region can be requested when creating a sandbox. For a region containing other regions, at least one must accept new sandboxes. This is not a health or capacity guarantee. |
| `id` | string | Yes | Region ID, the value a create request names in `region_id`. |
| `name` | string | Yes | Display name. |
| `parent_region_ids` | array of string | Yes | IDs of the containing regions, outermost first; the last is the direct parent. Empty for `earth`. All IDs appear in this response. A create that names one of these regions is placed here only if this region accepts automatic placement, and membership does not guarantee capacity. |

## RegionMultiplier

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `multiplier` | number (double) | Yes | The multiplier applied to base resource prices. |
| `region_id` | string | Yes | The region ID accepted by create requests. |

## RegionProxyToken

A token the region's own proxy authenticates with.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the token was created. |
| `expires_at` | string (date-time) \| null | No | When the token expires, or `null` when it does not. |
| `id` | string (uuid) | Yes | The proxy token ID. |
| `last_used_at` | string (date-time) \| null | No | When the token last authenticated, or `null` when it never has. |
| `name` | string \| null | No | The display name, or `null` when none was given. |
| `region_id` | string | Yes | The region the token is bound to. |
| `rotated_from` | string (uuid) \| null | No | The ID of the token this one replaced, or `null`. |
| `updated_at` | string (date-time) | Yes | When the token last changed: a rotation shortens the replaced token's lifetime. |

## RegistrationToken

A token that enrolls runners into one region until it expires or its uses
run out.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | string (date-time) | Yes | When the token was created. |
| `expires_at` | string (date-time) | Yes | When the token stops enrolling runners. |
| `id` | string (uuid) | Yes | The registration token ID. |
| `max_uses` | integer (int32) | Yes | How many runners the token may enroll. |
| `name` | string | Yes | The display name. |
| `region_id` | string | Yes | The region the token enrolls runners into. |
| `updated_at` | string (date-time) | Yes | When the token last changed. |
| `uses` | integer (int32) | Yes | How many runners the token has enrolled. |

## RegistryKind

Type: string: `basic`, `ghcr`, `gcr`, `ecr`, `ecr_role`

## Role

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | The role's purpose. |
| `id` | string | Yes | The role identifier. |
| `name` | string | Yes | The display name. |
| `permissions` | array of string | Yes | The permissions granted by the role. |

## ImageReference

Image used to create a sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The image ID. |
| `name` | string \| null | No | The image name, when one is assigned. |

## LifecyclePolicy

The sandbox's lifecycle policy: the configured timeout and idle expiry,
the deadlines derived from them, and the activity clock.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_expiry_seconds` | integer (int32) \| null | No | Configured idle expiry in seconds. |
| `idle_timeout_at` | string (date-time) \| null | No | Absolute idle-expiry deadline, or null when idle expiry is not armed. |
| `last_activity_at` | string (date-time) \| null | No | When activity was last observed, or null when no activity is recorded. |
| `last_activity_source` | string \| null | No | The kind of activity most recently observed, such as an explicit idle-timer reset (`api`), a running command, or sandbox traffic. Open vocabulary: treat an unrecognized value as sandbox activity. |
| `on_idle_timeout` | null \| [LifecycleAction](#lifecycleaction) | No | The action run when the idle expiry elapses, or null when idle expiry is not armed. |
| `on_timeout` | null \| [LifecycleAction](#lifecycleaction) | No | The action run when the timeout expires, or null when no timeout is armed. |
| `timeout_at` | string (date-time) \| null | No | Absolute timeout deadline, or null when no timeout is armed. |
| `timeout_seconds` | integer (int32) \| null | No | Configured timeout in seconds. |

## PortAssignment

A port the platform exposes for a sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `host_port` | integer (int32) | Yes | The port exposed on the platform side. |
| `proto` | [PortProtocol](#portprotocol) | Yes | The transport protocol. |
| `vm_port` | integer (int32) | Yes | The port inside the sandbox. |

## SnapshotReference

Snapshot used to create a sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The snapshot ID. |
| `name` | string \| null | No | The snapshot name, when one is assigned. |

## SandboxListItem

One sandbox in a paginated response.

Type: [Sandbox](#sandbox) & object

## SandboxUsageSample

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cpu_cores` | number (double) | Yes | Average CPU used over the latest sampling interval, in cores (1 core = 2 vCPUs; a macOS core is one Mac CPU). |
| `cpu_memory_available` | boolean | Yes | Whether CPU and memory measurements are available. |
| `cpu_nanoseconds` | integer (int64) | Yes | CPU time used since the sandbox started, in core-nanoseconds (1 core = 2 vCPUs; a macOS core is one Mac CPU). |
| `disk_read_bytes` | integer (int64) | Yes | Disk bytes read since the sandbox started. |
| `disk_read_bytes_per_second` | number (double) | Yes | Disk bytes read per second over the latest sampling interval. |
| `disk_total_bytes` | integer (int64) | Yes | Total sandbox disk size, in bytes. |
| `disk_used_bytes` | integer (int64) | Yes | Current disk space used, in bytes. |
| `disk_written_bytes` | integer (int64) | Yes | Disk bytes written since the sandbox started. |
| `disk_written_bytes_per_second` | number (double) | Yes | Disk bytes written per second over the latest sampling interval. |
| `memory_bytes` | integer (int64) | Yes | Current physical memory use, in bytes. |
| `network_received_bytes` | integer (int64) | Yes | Network bytes received since the sandbox started. |
| `network_received_bytes_per_second` | number (double) | Yes | Network bytes received per second over the latest sampling interval. |
| `network_sent_bytes` | integer (int64) | Yes | Network bytes sent since the sandbox started. |
| `network_sent_bytes_per_second` | number (double) | Yes | Network bytes sent per second over the latest sampling interval. |
| `sampled_at` | string (date-time) | Yes | Time the measurement was taken. |

## UsageHistoryResolution

Type: string: `minute`, `hour`

## UsagePeriod

Resource usage during one time bucket.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cpu_core_seconds` | number (double) | Yes | CPU time consumed in the bucket, in core-seconds (1 core = 2 vCPUs; a macOS core is one Mac CPU). |
| `disk_read_bytes` | integer (int64) | Yes | Bytes read from disk during the bucket. |
| `disk_used_bytes` | integer (int64) | Yes | Disk space used, in bytes: the last sample in the bucket at `minute` resolution, and the highest sample in the bucket at `hour` resolution. |
| `disk_written_bytes` | integer (int64) | Yes | Bytes written to disk during the bucket. |
| `duration_ms` | integer (int64) | Yes | Wall-clock span the bucket actually covered, ms. |
| `memory_byte_seconds` | number (double) | Yes | Memory integral over the bucket, byte-seconds. |
| `memory_peak_bytes` | integer (int64) | Yes | Peak physical memory use during the bucket, in bytes. |
| `network_received_bytes` | integer (int64) | Yes | Bytes received over the network during the bucket. |
| `network_sent_bytes` | integer (int64) | Yes | Bytes sent over the network during the bucket. |
| `start_at` | string (date-time) | Yes | Start of the bucket. |

## SnapshotClass

Type: string: `linux`

## SnapshotListItem

A snapshot with its pagination cursor.

Type: [Snapshot](#snapshot) & object

## SsoConnection

One single sign-on connection configured for an organization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `connection_type` | string | Yes | The connection protocol and provider type. |
| `created_at` | string (date-time) | Yes | When the connection was created. |
| `domains` | array of string | Yes | The email domains the connection signs in. |
| `id` | string | Yes | The connection ID. |
| `name` | string | Yes | The connection name. |
| `status` | string | Yes | The connection status. |
| `updated_at` | string (date-time) | Yes | When the connection was last updated. |

## BillingUsagePeriod

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount_cents` | integer (int64) | Yes | The pre-tax usage amount in cents. |
| `charges` | array of [UsageCharge](#usagecharge) | Yes | The itemized usage charges. |
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `end_at` | string (date-time) | Yes | The exclusive end of the usage period. |
| `issued_at` | string (date-time) | Yes | When the usage statement was issued. |
| `start_at` | string (date-time) | Yes | The inclusive beginning of the usage period. |
| `status` | [UsagePeriodStatus](#usageperiodstatus) | Yes | The usage period status. |
| `taxes_amount_cents` | integer (int64) | Yes | The tax amount in cents. |
| `total_amount_cents` | integer (int64) | Yes | The usage amount including taxes, in cents. |

## UsageReportEntry

Usage for one sandbox and interval.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `interval_start_at` | string (date-time) | Yes | Start of the aggregation interval. |
| `resources` | [UsageResources](#usageresources) | Yes | Resource consumption during the interval. |
| `sandbox_id` | string | Yes | The sandbox ID. |

## UsageReportResolution

Type: string: `hour`, `day`

## V0Sandbox

One sandbox available from the Daytona v0 migration source.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class` | string | Yes | The sandbox class on Daytona v0. |
| `cpu` | integer (int64) | Yes | CPU cores on Daytona v0. |
| `disk_gib` | integer (int64) | Yes | Disk storage in GiB on Daytona v0. |
| `importable` | boolean | Yes | Whether `POST /migration/v0/sandboxes/{v0_id}/import` can import it now. |
| `imported_sandbox_id` | string \| null | No | The imported sandbox ID when a live import exists. |
| `labels` | map of string | Yes | The sandbox labels. |
| `last_backup_at` | string (date-time) \| null | No | When Daytona v0 last completed a backup of the sandbox. |
| `memory_gib` | integer (int64) | Yes | Memory in GiB on Daytona v0. |
| `name` | string | Yes | The sandbox name. |
| `reason` | string \| null | No | Reason the sandbox cannot be imported when `importable` is false. Open vocabulary: clients must accept unrecognized reasons. |
| `status` | string | Yes | The sandbox status on Daytona v0. |
| `v0_id` | string | Yes | The sandbox ID on Daytona v0. |

## VolumeStatus

Type: string: `ready`, `deleting`, `deleted`, `error`

## BillingType

Type: string: `pre-paid`, `post-paid`

## BalanceApplicableTo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_names` | array of string \| null | No | Product names that can consume the balance, or `null` for no name filter. |
| `product_tags` | array of string \| null | No | Product tags that can consume the balance, or `null` for no tag filter. |

## BalanceType

Type: string: `credit`, `commit`

## BillingTaxIdType

Type: string: `ad_nrt`, `ae_trn`, `al_tin`, `am_tin`, `ao_tin`, `ar_cuit`, `au_abn`, `au_arn`, `aw_tin`, `az_tin`, `ba_tin`, `bb_tin`, `bd_bin`, `bf_ifu`, `bg_uic`, `bh_vat`, `bj_ifu`, `bo_tin`, `br_cnpj`, `br_cpf`, `bs_tin`, `by_tin`, `ca_bn`, `ca_gst_hst`, `ca_pst_bc`, `ca_pst_mb`, `ca_pst_sk`, `ca_qst`, `cd_nif`, `ch_uid`, `ch_vat`, `cl_tin`, `cm_niu`, `cn_tin`, `co_nit`, `cr_tin`, `cv_nif`, `de_stn`, `do_rcn`, `ec_ruc`, `eg_tin`, `es_cif`, `et_tin`, `eu_oss_vat`, `eu_vat`, `gb_vat`, `ge_vat`, `gn_nif`, `hk_br`, `hr_oib`, `hu_tin`, `id_npwp`, `il_vat`, `in_gst`, `is_vat`, `jp_cn`, `jp_rn`, `jp_trn`, `ke_pin`, `kg_tin`, `kh_tin`, `kr_brn`, `kz_bin`, `la_tin`, `li_uid`, `li_vat`, `ma_vat`, `md_vat`, `me_pib`, `mk_vat`, `mr_nif`, `mx_rfc`, `my_frp`, `my_itn`, `my_sst`, `ng_tin`, `no_vat`, `no_voec`, `np_pan`, `nz_gst`, `om_vat`, `pe_ruc`, `ph_tin`, `ro_tin`, `rs_pib`, `ru_inn`, `ru_kpp`, `sa_vat`, `sg_gst`, `sg_uen`, `si_tin`, `sn_ninea`, `sr_fin`, `sv_nit`, `th_vat`, `tj_tin`, `tr_tin`, `tw_vat`, `tz_vat`, `ua_vat`, `ug_tin`, `us_ein`, `uy_ruc`, `uz_tin`, `uz_vat`, `ve_rif`, `vn_tin`, `za_vat`, `zm_tin`, `zw_tin`, `other`

## ChargeStatus

Type: string: `succeeded`, `pending`, `failed`

## OidcProvider

Login provider used by the dashboard.

Type: string: `oidc`, `workos`

## CpuArchitecture

Type: string: `amd64`, `arm64`

## InvitationStatus

Type: string: `pending`, `declined`, `expired`

## InvoicePaymentStatus

Type: string: `pending`, `succeeded`, `failed`

## InvoiceStatus

Type: string: `draft`, `finalized`, `voided`

## InvoiceType

Type: string: `usage`, `scheduled`, `subscription`, `one_off`

## MacCatalogModel

One Mac model in one region.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `available` | integer (int64) | Yes | Macs of this model that a purchase in this region can reserve now. Another purchase can take a Mac first. 0 when the model has no price. |
| `model` | [MacModel](#macmodel) | Yes | The Mac model, as `GET /mac-models` lists it. |
| `price` | null \| [MacPrice](#macprice) | Yes | What one reservation of this model costs. Null where billing is not enabled. |

## MsaCommitType

Type: string: `prepaid`, `postpaid`

## MsaStatus

Type: string: `upcoming`, `active`, `expired`

## MsaDiscountType

Type: string: `multiplier`, `overwrite`, `tiered`

## PaymentMethodBrand

Type: string: `amex`, `cartes_bancaires`, `diners`, `discover`, `eftpos_au`, `interac`, `jcb`, `link`, `mastercard`, `unionpay`, `visa`, `other`

## EffectiveLinuxLifecyclePolicies

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ephemeral` | [EffectiveLifecyclePolicy](#effectivelifecyclepolicy) | Yes | The effective ephemeral policy. |

## EffectiveMacosLifecyclePolicies

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ephemeral` | [EffectiveLifecyclePolicy](#effectivelifecyclepolicy) | Yes | The effective ephemeral policy. |
| `persistent` | [EffectiveLifecyclePolicy](#effectivelifecyclepolicy) | Yes |  |

## EphemeralLifecycleDefaults

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_timeout_seconds` | integer (int64) \| null | Yes | Idle time before cleanup in seconds, or null to disable it. |
| `timeout_seconds` | integer (int64) \| null | Yes | Maximum sandbox lifetime in seconds, or null to inherit it. |

## PortProtocol

Type: string: `tcp`, `udp`

## UsageCharge

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `billable_metric` | string | Yes | The billing metric identifier. |
| `events_count` | integer (int64) | Yes | The number of usage events included. |
| `name` | string | Yes | The charge display name. |
| `quantity` | number (double) | Yes | The billed quantity. |
| `total_cents` | integer (int64) | Yes | The charge total in cents. |
| `units` | string | Yes | The unit used for the billed quantity. |

## UsagePeriodStatus

Type: string: `open`, `closed`

## UsageResources

Resource consumption within one interval.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cpu_core_seconds` | number (double) | Yes | CPU time used during the interval, in core-seconds (1 core = 2 vCPUs; a macOS core is one Mac CPU). |
| `disk_read_bytes` | integer (int64) | Yes | Bytes read from disk during the interval. |
| `disk_used_bytes` | integer (int64) | Yes | Highest disk space used during the interval, in bytes. |
| `disk_written_bytes` | integer (int64) | Yes | Bytes written to disk during the interval. |
| `memory_byte_seconds` | number (double) | Yes | Memory use integrated over the interval, in byte-seconds. |
| `memory_peak_bytes` | integer (int64) | Yes | Peak physical memory use during the interval, in bytes. |
| `network_received_bytes` | integer (int64) | Yes | Bytes received over the network during the interval. |
| `network_sent_bytes` | integer (int64) | Yes | Bytes sent over the network during the interval. |

## MacPrice

One reservation's price.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cents_per_hour` | number (double) | Yes | The hourly rate of one Mac in cents, which can be fractional. The amount charged is `period_cents`. |
| `currency` | string | Yes | The lowercase ISO 4217 currency code. |
| `period_cents` | integer (int64) | Yes | Price of one reservation period in cents, rounded up to a whole cent. Each period is charged when it is bought. |
| `period_seconds` | integer (int64) | Yes | The reservation period in seconds. |

## EffectiveLifecyclePolicy

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_timeout_seconds` | integer (int64) \| null | Yes | The effective idle timeout in seconds. |
| `on_idle_timeout` | null \| [LifecycleAction](#lifecycleaction) | Yes | The effective action at the idle timeout. |
| `on_timeout` | null \| [LifecycleAction](#lifecycleaction) | Yes | The effective action at the maximum lifetime. |
| `timeout_capped` | boolean | Yes | Whether a higher requested timeout was capped. |
| `timeout_seconds` | integer (int64) \| null | Yes | The effective maximum lifetime in seconds. |
| `timeout_source` | [TimeoutSource](#timeoutsource) | Yes | Where the effective maximum lifetime came from. |

## TimeoutSource

Type: string: `project`, `platform`, `none`
