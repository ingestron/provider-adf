// Dedicated demo foundation. Discovery resources deploy separately through deploy.py.
param location string = resourceGroup().location
param factoryName string
param storageName string
param sqlServerName string
param administratorObjectId string
@description('Verified Entra user principal name; avoid reserved display names such as Administrator.')
param administratorLogin string
param useCase string = 'northwind_azure'
param databaseName string = 'northwind'
var tags = {'ingestron-use-case': useCase, purpose: 'cli-discovery-showcase'}
resource factory 'Microsoft.DataFactory/factories@2018-06-01' = {
  name: factoryName
  location: location
  tags: tags
  identity: {type: 'SystemAssigned'}
  properties: {}
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {name: 'Standard_LRS'}
  properties: {
    isHnsEnabled: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Enabled'
  }
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}
resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'discovery'
  properties: {publicAccess: 'None'}
}
resource writer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(container.id, factory.id, 'metadata-writer')
  scope: container
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions','ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: factory.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
resource reader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(container.id, administratorObjectId, 'metadata-reader')
  scope: container
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions','2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')
    principalId: administratorObjectId
    principalType: 'User'
  }
}
resource sql 'Microsoft.Sql/servers@2023-08-01' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'User'
      login: administratorLogin
      sid: administratorObjectId
      tenantId: tenant().tenantId
      azureADOnlyAuthentication: true
    }
  }
}
resource database 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sql
  name: databaseName
  location: location
  tags: tags
  sku: {name: 'Basic', tier: 'Basic', capacity: 5}
  properties: {maxSizeBytes: 2147483648, requestedBackupStorageRedundancy: 'Local'}
}
// Explicit demo network choice: Azure-hosted clients can reach the Entra-only SQL endpoint.
resource azureAccess 'Microsoft.Sql/servers/firewallRules@2023-08-01' = {
  parent: sql
  name: 'AllowAzureServices'
  properties: {startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0'}
}
resource source 'Microsoft.DataFactory/factories/linkedservices@2018-06-01' = {
  parent: factory
  name: 'northwind_azure_source'
  properties: {
    type: 'AzureSqlDatabase'
    version: '2.0'
    annotations: ['ingestron:${useCase}']
    typeProperties: {server: '${sql.name}${environment().suffixes.sqlServerHostname}', database: database.name, authenticationType: 'SystemAssignedManagedIdentity', encrypt: 'mandatory', trustServerCertificate: false}
  }
}
resource sink 'Microsoft.DataFactory/factories/linkedservices@2018-06-01' = {
  parent: factory
  name: 'metadata_lake'
  properties: {type: 'AzureBlobFS', annotations: ['ingestron:${useCase}'], typeProperties: {url: 'https://${storage.name}.dfs.${environment().suffixes.storage}'}}
}
output factoryPrincipalId string = factory.identity.principalId
output serverHost string = '${sql.name}${environment().suffixes.sqlServerHostname}'
output storageAccount string = storage.name
