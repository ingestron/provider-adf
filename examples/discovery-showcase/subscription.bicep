targetScope = 'subscription'
param resourceGroupName string
param location string = 'australiaeast'
param factoryName string
param storageName string
param sqlServerName string
param administratorObjectId string
param administratorLogin string
resource group 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: {purpose: 'ingestron-cli-showcase', owner: 'ingestron'}
}
module foundation './showcase.bicep' = {
  name: 'ingestron-showcase-foundation'
  scope: group
  params: {
    location: location
    factoryName: factoryName
    storageName: storageName
    sqlServerName: sqlServerName
    administratorObjectId: administratorObjectId
    administratorLogin: administratorLogin
  }
}
output factoryPrincipalId string = foundation.outputs.factoryPrincipalId
output serverHost string = foundation.outputs.serverHost
output storageAccount string = foundation.outputs.storageAccount
