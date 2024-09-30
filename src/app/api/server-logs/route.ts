import { NextRequest, NextResponse } from 'next/server';
import { ServerLogger } from '../../../utils/Logger-Interface/service/serverLogger/serverLogger';
import path from 'path';
import fs from 'fs';
 

export async function GET(req: NextRequest) {
  try {
    const serverLogger = ServerLogger.getInstance();
    const logs = await serverLogger.getLogs();
    return NextResponse.json(logs, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching server logs:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}



export async function DELETE(req: NextRequest) 
{
  try 
  {
    const serverLogger = ServerLogger.getInstance();
    
    // Vider tous les logs
    await serverLogger.clearLogs();
    
    // Supprimer le contenu du fichier server-logs.json
    await fs.promises.unlink(path.join(process.cwd(), 'server-logs.json'));
    
    return NextResponse.json({ message: 'Les logs ont été effacés avec succès.' }, { status: 200 });
  } catch (error: any) {
    console.error('Erreur lors de l\'effacement des logs:', error);
    return NextResponse.json({ error: 'Une erreur est survenue lors de l\'effacement des logs.' }, { status: 500 });
  }
}
