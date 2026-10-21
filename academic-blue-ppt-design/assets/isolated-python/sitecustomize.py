"""Enforce the same copied-task boundary in Python child processes."""
import os,sys,json
root=os.environ.get('PPT_ISOLATION_ROOT');project=os.environ.get('PPT_EXCLUDED_PROJECT_ROOT')
if root and project:
    root=os.path.normcase(os.path.abspath(root));project=os.path.normcase(os.path.abspath(project))
    phase=''.join(c for c in os.environ.get('PPT_ISOLATION_PHASE','') if c.isalnum() or c in '_-')
    logfile=os.path.join(root,'isolation-python-io'+('-'+phase if phase else '')+'.jsonl')
    def inside(p,base):
        try:return os.path.commonpath([p,base])==base
        except ValueError:return False
    def audit(event,args):
        if event not in ['open','os.listdir','os.scandir'] or not args:return
        p=args[0]
        if not isinstance(p,(str,bytes,os.PathLike)):return
        p=os.path.normcase(os.path.abspath(os.fsdecode(p)))
        if p==logfile:return
        if not inside(p,project):return
        denied=not inside(p,root)
        fd=os.open(logfile,os.O_WRONLY|os.O_CREAT|os.O_APPEND)
        try:os.write(fd,(json.dumps({'event':event,'path':p,'denied':denied},ensure_ascii=False)+'\n').encode('utf-8'))
        finally:os.close(fd)
        if denied:raise PermissionError('ISOLATED_PROJECT_READ_DENIED: '+p)
    sys.addaudithook(audit)
