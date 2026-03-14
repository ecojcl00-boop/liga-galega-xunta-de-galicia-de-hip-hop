import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, CheckCircle, AlertCircle, FileText, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function ImportarDatos() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState([]);
  
  // Estado para importar inscripciones
  const [inscripcionesFile, setInscripcionesFile] = useState(null);
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [inscripcionesStatus, setInscripcionesStatus] = useState(null);
  const [competitionMode, setCompetitionMode] = useState('existing');
  const [newCompName, setNewCompName] = useState('');
  const [newCompDate, setNewCompDate] = useState('');
  const [newCompJornada, setNewCompJornada] = useState('1');
  const [previewGroups, setPreviewGroups] = useState(null);
  
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

  const handlePreviewInscripciones = async () => {
    if (!inscripcionesFile) {
      setInscripcionesStatus({ type: 'error', message: 'Selecciona un archivo' });
      return;
    }

    if (competitionMode === 'existing' && !selectedCompetition) {
      setInscripcionesStatus({ type: 'error', message: 'Selecciona una competición' });
      return;
    }

    if (competitionMode === 'new' && (!newCompName || !newCompDate || !newCompJornada)) {
      setInscripcionesStatus({ type: 'error', message: 'Completa los datos de la competición' });
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

    const groups = parseInscripciones(result.output);
    setPreviewGroups(groups);
    setInscripcionesStatus({ 
      type: 'success', 
      message: `Vista previa: ${groups.length} grupos encontrados` 
    });
    setLoading(false);
  };

  const handleConfirmInscripciones = async () => {
    if (!previewGroups) return;

    setLoading(true);
    setInscripcionesStatus({ type: 'loading', message: 'Guardando datos...' });

    let compId = selectedCompetition;

    if (competitionMode === 'new') {
      const newComp = await base44.entities.LigaCompeticion.create({
        name: newCompName,
        date: newCompDate,
        numero_jornada: parseInt(newCompJornada),
        is_simulacro: false
      });
      compId = newComp.id;
      await loadData();
    }

    await base44.entities.Group.bulkCreate(previewGroups);

    setInscripcionesStatus({ 
      type: 'success', 
      message: `Importados ${previewGroups.length} grupos correctamente` 
    });
    setLoading(false);
    setInscripcionesFile(null);
    setPreviewGroups(null);
    setNewCompName('');
    setNewCompDate('');
    setNewCompJornada('1');
  };

  const calcularPuntosLiga = (puesto) => {
    const tablaPuntos = {
      1: 100, 2: 90, 3: 80, 4: 70, 5: 60,
      6: 50, 7: 40, 8: 30, 9: 20, 10: 10
    };
    return tablaPuntos[puesto] || 0;
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
          puntuacion: { type: 'number' }
        }
      }
    });

    if (result.status === 'error') {
      setResultadosStatus({ type: 'error', message: result.details });
      setLoading(false);
      return;
    }

    setResultadosStatus({ type: 'loading', message: 'Calculando puntos de liga...' });
    
    const resultados = result.output.map(r => ({
      ...r,
      competicion_id: resultadosCompetition,
      puntos_liga: calcularPuntosLiga(r.puesto),
      is_simulacro: false
    }));
    
    setResultadosStatus({ type: 'loading', message: 'Guardando resultados...' });
    await base44.entities.LigaResultado.bulkCreate(resultados);

    setResultadosStatus({ 
      type: 'success', 
      message: `Importados ${resultados.length} resultados con puntos calculados` 
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
    <div className="min-h-screen bg-[hsl(0,0%,4%)] p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">Importar Datos</h1>
        
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
                  <label className="block text-sm font-medium mb-3">
                    Competición
                  </label>
                  <RadioGroup value={competitionMode} onValueChange={setCompetitionMode}>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="existing" id="existing" />
                      <Label htmlFor="existing">Seleccionar existente</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="new" id="new" />
                      <Label htmlFor="new">Crear nueva</Label>
                    </div>
                  </RadioGroup>
                </div>

                {competitionMode === 'existing' && (
                  <div>
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
                )}

                {competitionMode === 'new' && (
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <div>
                      <Label>Nombre</Label>
                      <Input
                        value={newCompName}
                        onChange={(e) => setNewCompName(e.target.value)}
                        placeholder="Ej: MARÍN 2026"
                      />
                    </div>
                    <div>
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={newCompDate}
                        onChange={(e) => setNewCompDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Número de Jornada</Label>
                      <Input
                        type="number"
                        value={newCompJornada}
                        onChange={(e) => setNewCompJornada(e.target.value)}
                        min="1"
                      />
                    </div>
                  </div>
                )}
                
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

                {!previewGroups ? (
                  <Button
                    onClick={handlePreviewInscripciones}
                    disabled={!inscripcionesFile || loading}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {loading ? 'Procesando...' : 'Vista Previa'}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Card className="bg-muted">
                      <CardContent className="pt-4">
                        <h3 className="font-semibold mb-2">Resumen de Importación</h3>
                        <p className="text-sm mb-2">Total de grupos: {previewGroups.length}</p>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {previewGroups.map((g, i) => (
                            <div key={i} className="text-xs bg-background p-2 rounded">
                              <strong>{g.name}</strong> - {g.school_name} ({g.category})
                              <br />
                              <span className="text-muted-foreground">
                                {g.participants.length} participante(s)
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setPreviewGroups(null);
                          setInscripcionesFile(null);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleConfirmInscripciones}
                        disabled={loading}
                        className="flex-1"
                      >
                        {loading ? 'Guardando...' : 'Confirmar Importación'}
                      </Button>
                    </div>
                  </div>
                )}

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