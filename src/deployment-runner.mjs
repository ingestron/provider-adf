// Standalone customer-side runner; never executed by the offline compiler.
export const runner = String.raw`#!/usr/bin/env python3
"""Reviewable ADF deployment. Uses an existing Azure CLI login, never stored credentials."""
import argparse, hashlib, json, pathlib, subprocess, sys, re
ROOT = pathlib.Path(__file__).resolve().parent

def az(*args):
    result = subprocess.run(['az', *args, '--only-show-errors', '--output', 'json'], capture_output=True, text=True, timeout=600)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or 'Azure CLI command failed')
    return json.loads(result.stdout) if result.stdout.strip() else None

def digest(template, config, subscription, group):
    return hashlib.sha256(json.dumps([template, config, subscription, group], sort_keys=True).encode()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'plan', 'apply', 'run', 'status', 'download'])
    parser.add_argument('--subscription', required=True)
    parser.add_argument('--resource-group', required=True)
    parser.add_argument('--approve', help='Reviewed digest printed by plan; required for apply')
    parser.add_argument('--approve-init', action='store_true', help='Explicitly approve new factory creation')
    parser.add_argument('--run-id')
    parser.add_argument('--storage-account')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-fA-F-]{36}', args.subscription) or not re.fullmatch(r'[A-Za-z0-9_.()-]{1,90}', args.resource_group):
        raise RuntimeError('Supply an explicit subscription UUID and resource group')
    if args.run_id and not re.fullmatch(r'[0-9a-fA-F-]{36}', args.run_id):
        raise RuntimeError('Invalid run ID')
    config = json.loads((ROOT/'deployment.json').read_text())
    template = json.loads((ROOT/'template.json').read_text())
    base = ['--subscription', args.subscription, '--resource-group', args.resource_group]
    factory = config['factoryName']
    scope = '/subscriptions/'+args.subscription+'/resourceGroups/'+args.resource_group+'/providers/Microsoft.DataFactory/factories/'+factory
    factories = az('resource', 'list', *base, '--resource-type', 'Microsoft.DataFactory/factories')
    found = next((f for f in factories if f['name'].lower()==factory.lower()), None)
    if args.action=='init':
        if config['mode']!='new-factory' or found or not args.approve_init:
            raise RuntimeError('init requires new-factory mode, an unused factory name and --approve-init')
        factory_template = dict(template, resources=[r for r in template['resources'] if r['type']=='Microsoft.DataFactory/factories'])
        path = ROOT/'factory-init.json'
        path.write_text(json.dumps(factory_template, indent=2))
        print(json.dumps(az('deployment', 'group', 'create', *base, '--name', 'ingestron-'+config['useCase']+'-init', '--mode', 'Incremental', '--template-file', str(path)), indent=2))
        return
    if not found:
        raise RuntimeError('Factory does not exist. Review and run init first for a new factory.')
    if config['mode']=='new-factory' and found.get('tags',{}).get('ingestron-use-case')!=config['useCase']:
        raise RuntimeError('Existing factory is not owned by this new-factory use case')
    if args.action in ['plan','apply']:
        # Ignore factory resource after init: never reset existing factory configuration.
        effective = dict(template, resources=[dict(r, dependsOn=[d for d in r.get('dependsOn',[]) if "/factories'," not in d]) for r in template['resources'] if r['type']!='Microsoft.DataFactory/factories'])
        expected_ls={'azure-sql':'AzureSqlDatabase','sql-server':'SqlServer','postgresql':'PostgreSqlV2'}[config['sourceKind']]
        links = az('rest','--method','get','--url',scope+'/linkedservices?api-version=2018-06-01')['value']
        for name, kind in [(config['sourceLinkedService'],expected_ls),(config['sinkLinkedService'],'AzureBlobFS')]:
            link=next((l for l in links if l['name']==name),None)
            if not link or link['properties']['type']!=kind:
                raise RuntimeError('Configure the reviewed '+kind+' linked service '+name+' before deployment')
        owned_state=[]
        for kind in ['datasets','pipelines']:
            remote = az('rest','--method','get','--url',scope+'/'+kind+'?api-version=2018-06-01')['value']
            for item in remote:
                if item['name'] in config['resourceNames']: owned_state.append(item)
                if item['name'] in config['resourceNames'] and 'ingestron:'+config['useCase'] not in item.get('properties',{}).get('annotations',[]):
                    raise RuntimeError('Refusing to overwrite unowned resource '+item['name'])
        reviewed_digest=digest(effective, dict(config, ownedState=sorted(owned_state,key=lambda r:r["name"])), args.subscription, args.resource_group)
        path=ROOT/'deployment-template.json'
        path.write_text(json.dumps(effective,indent=2))
        if args.action=='plan':
            changes=az('deployment','group','what-if',*base,'--no-pretty-print','--name','ingestron-'+config['useCase'],'--mode','Incremental','--template-file',str(path))
            print(json.dumps({'digest':reviewed_digest,'changes':changes,'mode':'Incremental','resources':config['resourceNames']},indent=2))
        else:
            if args.approve!=reviewed_digest:
                raise RuntimeError('Run plan and supply its reviewed digest with --approve')
            print(json.dumps(az('deployment','group','create',*base,'--name','ingestron-'+config['useCase'],'--mode','Incremental','--template-file',str(path)),indent=2))
    elif args.action=='run':
        print(json.dumps(az('rest','--method','post','--url',scope+'/pipelines/'+config['pipelineName']+'/createRun?api-version=2018-06-01','--body','{}'),indent=2))
    else:
        if not args.run_id:
            raise RuntimeError('Supply --run-id from run')
        status=az('rest','--method','get','--url',scope+'/pipelineruns/'+args.run_id+'?api-version=2018-06-01')
        if args.action=='status':
            print(json.dumps({k:status.get(k) for k in ['runId','status','runStart','runEnd','message']},indent=2))
        else:
            if status.get('status')!='Succeeded' or status.get('pipelineName')!=config['pipelineName'] or not args.storage_account:
                raise RuntimeError('Download requires a successful discovery run and --storage-account')
            target=ROOT/(args.run_id+'-metadata.json')
            if target.exists() or (ROOT/(args.run_id+'-import.json')).exists():
                raise RuntimeError('Metadata destination already exists')
            az('storage','fs','file','download','--subscription',args.subscription,'--account-name',args.storage_account,'--auth-mode','login','--file-system',config['fileSystem'],'--path','discovery/'+config['useCase']+'/'+args.run_id+'/metadata.json','--destination',str(target))
            rows=json.loads(target.read_text(encoding='utf-8-sig'))
            proposal={'sourceId':config['useCase'],'sourceKind':config['sourceKind'],'rows':rows}
            out=ROOT/(args.run_id+'-import.json')
            out.write_text(json.dumps(proposal,indent=2))
            print(str(out))
if __name__=='__main__':
    try: main()
    except (RuntimeError, ValueError, KeyError, OSError, subprocess.TimeoutExpired) as exc:
        print(str(exc),file=sys.stderr)
        sys.exit(1)
`;
