import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function ImportarDatos() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState([]);
  
  // Estado para importar inscripciones
  const [inscripcionesFile, setInscripcionesFile] = useState(null);
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [inscripcionesStatus, setInscripcionesStatus] = useState(null);
  
  // Estado para importar resultados
  const [resultadosFile, setResultadosFile] = useState(null);
  const [resultadosCompetition, setResultadosCompetition] = useState('');
  const [resultadosStatus, setResultadosStatus] = useState(null);
  
  // Estado para subir actas
  const [actaFile, setActaFile] = useState(null);
  const [actaSchool, setActaSchool] = useState('');
  const [actaCompetition, setActaCompetition] = useState('');
  const [actaStatus, setActaStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    
    if (currentUser?.role !== 'admin') {
      return;
    }
    
    const comps = await base44.entities.LigaCompeticion.list();
    setCompetitions(comps);
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tienes permisos para acceder a esta página
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const parseInscripciones = (data) => {
    const groups = [];
    
    data.forEach(row => {
      const participants = [];
      
      let i = 1;
      while (row[`nombre_participante_${i}`] || row[`fecha_nacimiento_${i}`]) {
        if (row[`nombre_participante_${i}`]) {
          participants.push({
            name: row[`nombre_participante_${i}`],
            birth_date: row[`fecha_nacimiento_${i}`] || '',
            dni: ''
          });
        }
        i++;
      }

      groups.push({
        name: row.nombre_grupo,
        school_name: row.escuela,
        category: row.categoria,
        coach_name: row.nombre_entrenador,
        coach_email: row.email_entrenador,
        coach_phone: row.telefono_entrenador,
        participants: participants
      });
    });

    return groups;
  };

  const handleImportInscripciones = async () => {
    if (!inscripcionesFile || !selectedCompetition) {
      setInscripcionesStatus({ type: 'error', message: 'Selecciona un archivo y una competición' });
      return;
    }

    setLoading(true);
    setInscripcionesStatus({ type: 'loading', message: 'Subiendo archivo...' });

    const { file_url } = await base44.integrations.Core.UploadFile({ file: inscripcionesFile });
    
    setInscripcionesStatus({ type: 'loading', message: 'Extrayendo datos...' });
    
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          nombre_grupo: { type: 'string' },
          escuela: { type: 'string' },
          categoria: { type: 'string' },
          nombre_entrenador: { type: 'string' },
          email_entrenador: { type: 'string' },
          telefono_entrenador: { type: 'string' },
          nombre_participante_1: { type: 'string' },
          fecha_nacimiento_1: { type: 'string' },
          nombre_participante_2: { type: 'string' },
          fecha_nacimiento_2: { type: 'string' },
          nombre_participante_3: { type: 'string' },
          fecha_nacimiento_3: { type: 'string' },
          nombre_participante_4: { type: 'string' },
          fecha_nacimiento_4: { type: 'string' },
          nombre_participante_5: { type: 'string' },
          fecha_nacimiento_5: { type: 'string' },
          nombre_participante_6: { type: 'string' },
          fecha_nacimiento_6: { type: 'string' },
          nombre_participante_7: { type: 'string' },
          fecha_nacimiento_7: { type: 'string' },
          nombre_participante_8: { type: 'string' },
          fecha_nacimiento_8: { type: 'string' }
        }
      }
    });

    if (result.status === 'error') {
      setInscripcionesStatus({ type: 'error', message: result.details });
      setLoading(false);
      return;
    }

    setInscripcionesStatus({ type: 'loading', message: 'Creando grupos...' });
    
    const groups = parseInscripciones(result.output);
    await base44.entities.Group.bulkCreate(groups);

    setInscripcionesStatus({ 
      type: 'success', 
      message: `Importados ${groups.length} grupos correctamente` 
    });
    setLoading(false);
    setInscripcionesFile(null);
  };

  const handleImportResultados = async () => {
    if (!resultadosFile || !resultadosCompetition) {
      setResultadosStatus({ type: 'error', message: 'Selecciona un archivo y una competición' });
      return;
    }

    setLoading(true);
    setResultadosStatus({ type: 'loading', message: 'Subiendo archivo...' });

    const { file_url } = await base44.integrations.Core.UploadFile({ file: resultadosFile });
    
    setResultadosStatus({ type: 'loading', message: 'Extrayendo resultados...' });
    
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          numero_jornada: { type: 'number' },
          grupo_nombre: { type: 'string' },
          school_name: { type: 'string' },
          categoria: { type: 'string' },
          puesto: { type: 'number' },
          puntuacion: { type: 'number' },
          puntos_liga: { type: 'number' }
        }
      }
    });

    if (result.status === 'error') {
      setResultadosStatus({ type: 'error', message: result.details });
      setLoading(false);
      return;
    }

    setResultadosStatus({ type: 'loading', message: 'Guardando resultados...' });
    
    const resultados = result.output.map(r => ({
      ...r,
      competicion_id: resultadosCompetition,
      is_simulacro: false
    }));
    
    await base44.entities.LigaResultado.bulkCreate(resultados);

    setResultadosStatus({ 
      type: 'success', 
      message: `Importados ${resultados.length} resultados correctamente` 
    });
    setLoading(false);
    setResultadosFile(null);
  };

  const handleUploadActa = async () => {
    if (!actaFile || !actaSchool || !actaCompetition) {
      setActaStatus({ type: 'error', message: 'Completa todos los campos' });
      return;
    }

    setLoading(true);
    setActaStatus({ type: 'loading', message: 'Subiendo acta...' });

    const { file_url } = await base44.integrations.Core.UploadFile({ file: actaFile });
    
    const competition = competitions.find(c => c.id === actaCompetition);
    
    await base44.entities.ActaJueces.create({
      school_name: actaSchool,
      competition_name: competition?.name || '',
      file_url: file_url,
      file_name: actaFile.name,
      fecha: new Date().toISOString().split('T')[0]
    });

    setActaStatus({ 
      type: 'success', 
      message: 'Acta subida correctamente' 
    });
    setLoading(false);
    setActaFile(null);
    setActaSchool('');
  };

  const StatusMessage = ({ status }) => {
    if (!status) return null;
    
    return (
      <Card className={
        status.type === 'success' ? 'border-green-500' :
        status.type === 'error' ? 'border-red-500' : 'border-blue-500'
      }>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            {status.type === 'success' && (
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            )}
            {status.type === 'error' && (
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            )}
            {status.type === 'loading' && (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mt-0.5" />
            )}
            <p className="text-sm">{status.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Importar Datos</h1>
        
        <Tabs defaultValue="inscripciones" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inscripciones">Inscripciones</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
            <TabsTrigger value="actas">Actas de Jueces</TabsTrigger>
          </TabsList>
          
          <TabsContent value="inscripciones">
            <Card>
              <CardHeader>
                <CardTitle>Importar Inscripciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Competición
                  </label>
                  <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una competición" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitions.map(comp => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.name} - Jornada {comp.numero_jornada}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Archivo Excel (.xlsx)
                  </label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setInscripcionesFile(e.target.files[0])}
                    disabled={loading}
                  />
                </div>

                <Button
                  onClick={handleImportInscripciones}
                  disabled={!inscripcionesFile || !selectedCompetition || loading}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {loading ? 'Importando...' : 'Importar Inscripciones'}
                </Button>

                <StatusMessage status={inscripcionesStatus} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="resultados">
            <Card>
              <CardHeader>
                <CardTitle>Importar Resultados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Competición
                  </label>
                  <Select value={resultadosCompetition} onValueChange={setResultadosCompetition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una competición" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitions.map(comp => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.name} - Jornada {comp.numero_jornada}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Archivo (.xlsx o .pdf)
                  </label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.pdf"
                    onChange={(e) => setResultadosFile(e.target.files[0])}
                    disabled={loading}
                  />
                </div>

                <Button
                  onClick={handleImportResultados}
                  disabled={!resultadosFile || !resultadosCompetition || loading}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {loading ? 'Importando...' : 'Importar Resultados'}
                </Button>

                <StatusMessage status={resultadosStatus} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="actas">
            <Card>
              <CardHeader>
                <CardTitle>Subir Acta de Jueces</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Escuela
                  </label>
                  <Input
                    type="text"
                    placeholder="Nombre de la escuela"
                    value={actaSchool}
                    onChange={(e) => setActaSchool(e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Competición
                  </label>
                  <Select value={actaCompetition} onValueChange={setActaCompetition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una competición" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitions.map(comp => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.name} - Jornada {comp.numero_jornada}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Archivo PDF
                  </label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setActaFile(e.target.files[0])}
                    disabled={loading}
                  />
                </div>

                <Button
                  onClick={handleUploadActa}
                  disabled={!actaFile || !actaSchool || !actaCompetition || loading}
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {loading ? 'Subiendo...' : 'Subir Acta'}
                </Button>

                <StatusMessage status={actaStatus} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}