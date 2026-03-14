import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

export default function ImportData() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus(null);
    }
  };

  const parseExcelData = (data) => {
    const groups = [];
    
    data.forEach(row => {
      const participants = [];
      
      // Extraer participantes (pares de nombre y fecha)
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

  const handleImport = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Por favor selecciona un archivo' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'loading', message: 'Subiendo archivo...' });

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    setStatus({ type: 'loading', message: 'Extrayendo datos...' });
    
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
      setStatus({ type: 'error', message: result.details });
      setLoading(false);
      return;
    }

    setStatus({ type: 'loading', message: 'Creando grupos...' });
    
    const groups = parseExcelData(result.output);
    await base44.entities.Group.bulkCreate(groups);

    setStatus({ type: 'loading', message: 'Creando competición...' });
    
    await base44.entities.LigaCompeticion.create({
      name: 'MARÍN 2026',
      date: '2026-03-01',
      numero_jornada: 1,
      is_simulacro: false
    });

    setStatus({ 
      type: 'success', 
      message: `Importados ${groups.length} grupos y creada competición MARÍN 2026` 
    });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Importar Inscripciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Archivo Excel de Inscripciones
                </label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </div>

              <Button
                onClick={handleImport}
                disabled={!file || loading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {loading ? 'Importando...' : 'Importar Datos'}
              </Button>
            </div>

            {status && (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}