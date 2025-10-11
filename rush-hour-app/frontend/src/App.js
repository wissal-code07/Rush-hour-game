import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Upload, Zap, AlertCircle, CheckCircle, Car } from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:5000/api';

const RushHourGame = () => {
  const [puzzle, setPuzzle] = useState(null);
  const [initialCSV, setInitialCSV] = useState('');
  const [moveCount, setMoveCount] = useState(0);
  const [solution, setSolution] = useState(null);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const [solving, setSolving] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('bfs');

  // Afficher un message
  const showMessage = useCallback((text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'info' }), 5000);
  }, []);

  // Vérifier la connexion à l'API
  const checkAPIConnection = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      if (data.status === 'ok') {
        setApiConnected(true);
        showMessage("✅ Connecté à l'API Python", 'success');
      }
    } catch (error) {
      setApiConnected(false);
      showMessage('❌ API non disponible. Lancez le backend Python!', 'error');
    }
  }, [showMessage]);

  useEffect(() => {
    checkAPIConnection();
  }, [checkAPIConnection]);

  // Fonction pour obtenir la classe CSS du véhicule
  const getVehicleClass = (vid) => {
    if (vid === 'X') return 'vehicle vehicle-red';
    const colorMap = {
      'A': 'vehicle vehicle-blue',
      'B': 'vehicle vehicle-green',
      'C': 'vehicle vehicle-yellow',
      'D': 'vehicle vehicle-purple',
      'E': 'vehicle vehicle-pink',
      'F': 'vehicle vehicle-indigo',
      'G': 'vehicle vehicle-cyan',
      'H': 'vehicle vehicle-orange',
      'I': 'vehicle vehicle-teal',
      'J': 'vehicle vehicle-lime'
    };
    return colorMap[vid] || 'vehicle vehicle-blue';
  };

  // Charger un fichier CSV
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target.result;
      setInitialCSV(csvContent);

      try {
        showMessage('📂 Chargement du puzzle...', 'info');
        
        const response = await fetch(`${API_URL}/parse-csv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: csvContent })
        });

        const data = await response.json();

        if (data.success) {
          setPuzzle(data.puzzle);
          setMoveCount(0);
          setSolution(null);
          setSolutionIndex(0);
          setAutoPlay(false);
          showMessage('✅ Puzzle chargé avec succès!', 'success');
        } else {
          showMessage(`❌ Erreur: ${data.error}`, 'error');
        }
      } catch (error) {
        showMessage('❌ Erreur de connexion à l\'API', 'error');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  // Résoudre le puzzle
  const solvePuzzle = async (algorithm = selectedAlgorithm) => {
    if (!initialCSV) {
      showMessage('⚠️ Chargez d\'abord un fichier CSV!', 'warning');
      return;
    }

    setSolving(true);
    showMessage(`🔄 Résolution avec ${getAlgorithmName(algorithm)}...`, 'info');

    try {
      const response = await fetch(`${API_URL}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: initialCSV,
          algorithm: algorithm
        })
      });

      const data = await response.json();

      if (data.success) {
        setSolution(data.solution);
        setSolutionIndex(0);
        showMessage(
          `✅ Solution trouvée! ${data.moves} mouvements (${getAlgorithmName(algorithm)})`,
          'success'
        );
      } else {
        showMessage(`❌ ${data.error}`, 'error');
      }
    } catch (error) {
      showMessage('❌ Erreur lors de la résolution', 'error');
      console.error(error);
    } finally {
      setSolving(false);
    }
  };

  // Obtenir le nom affichable de l'algorithme
  const getAlgorithmName = (algo) => {
    const names = {
      'bfs': 'BFS',
      'astar_h1': 'A* (Heuristique 1)',
      'astar_h2': 'A* (Heuristique 2)',
      'astar_h3': 'A* (Heuristique 3)'
    };
    return names[algo] || algo;
  };

  // Vérifier si le puzzle est résolu
  const isGoal = useCallback(() => {
    if (!puzzle || !puzzle.vehicles.X) return false;
    const x = puzzle.vehicles.X;
    return x.x + x.length === puzzle.width && x.y === Math.floor(puzzle.height / 2) - 1;
  }, [puzzle]);

  // Créer le plateau
  const createBoard = () => {
    if (!puzzle) return [];

    const board = Array(puzzle.height).fill(null).map(() =>
      Array(puzzle.width).fill(' ')
    );

    // Placer les murs
    puzzle.walls.forEach(([x, y]) => {
      if (y >= 0 && y < puzzle.height && x >= 0 && x < puzzle.width) {
        board[y][x] = '#';
      }
    });

    // Placer les véhicules
    Object.entries(puzzle.vehicles).forEach(([vid, data]) => {
      const { x, y, orientation, length } = data;
      for (let i = 0; i < length; i++) {
        if (orientation === 'H') {
          if (y >= 0 && y < puzzle.height && x + i >= 0 && x + i < puzzle.width) {
            board[y][x + i] = vid;
          }
        } else {
          if (y + i >= 0 && y + i < puzzle.height && x >= 0 && x < puzzle.width) {
            board[y + i][x] = vid;
          }
        }
      }
    });

    return board;
  };

  // Appliquer le prochain mouvement
  const applyNextMove = useCallback(() => {
    if (!solution || solutionIndex >= solution.length) return;

    const action = solution[solutionIndex];
    const [vid, direction, step] = action;

    setPuzzle(prev => {
      const newPuzzle = JSON.parse(JSON.stringify(prev));
      const vehicle = newPuzzle.vehicles[vid];

      if (vehicle) {
        if (direction === 'left') vehicle.x -= step || 1;
        else if (direction === 'right') vehicle.x += step || 1;
        else if (direction === 'up') vehicle.y -= step || 1;
        else if (direction === 'down') vehicle.y += step || 1;
      }

      return newPuzzle;
    });

    setMoveCount(prev => prev + 1);
    setSolutionIndex(prev => prev + 1);
  }, [solution, solutionIndex]);

  // Auto-play
  useEffect(() => {
    if (autoPlay && solution && solutionIndex < solution.length) {
      const timer = setTimeout(() => {
        applyNextMove();
      }, 500);
      return () => clearTimeout(timer);
    } else if (autoPlay && solutionIndex >= solution.length) {
      setAutoPlay(false);
      if (isGoal()) {
        showMessage(`🎉 Puzzle résolu en ${moveCount} mouvements!`, 'success');
      }
    }
  }, [autoPlay, solutionIndex, solution, applyNextMove, isGoal, moveCount, showMessage]);

  // Reset
  const resetGame = async () => {
    if (!initialCSV) return;

    try {
      const response = await fetch(`${API_URL}/parse-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: initialCSV })
      });

      const data = await response.json();

      if (data.success) {
        setPuzzle(data.puzzle);
        setMoveCount(0);
        setSolution(null);
        setSolutionIndex(0);
        setAutoPlay(false);
        showMessage('🔄 Jeu réinitialisé', 'success');
      }
    } catch (error) {
      showMessage('❌ Erreur lors de la réinitialisation', 'error');
    }
  };

  // Étape manuelle de la solution
  const stepSolution = () => {
    if (solution && solutionIndex < solution.length) {
      applyNextMove();
    }
  };

  const board = createBoard();
  const cellSize = puzzle ? Math.min(80, Math.floor(600 / Math.max(puzzle.width, puzzle.height))) : 80;
  const progress = solution ? (solutionIndex / solution.length) * 100 : 0;

  return (
    <div className="rush-hour-container">
      {/* Header */}
      <header className="game-header">
        <div className="header-content">
          <div className="title-section">
            <Car className="header-icon" size={48} />
            <h1 className="game-title">Rush Hour Solver</h1>
          </div>
          <p className="game-subtitle">Déplacez la voiture rouge vers la sortie en évitant les obstacles</p>
          
          {/* Status API */}
          <div className={`api-status ${apiConnected ? 'connected' : 'disconnected'}`}>
            {apiConnected ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{apiConnected ? 'API Connectée' : 'API Déconnectée'}</span>
          </div>
        </div>
      </header>

      <div className="game-layout">
        {/* Section principale : Plateau + Contrôles */}
        <div className="main-content">
          {/* Plateau de jeu */}
          <div className="game-board-section">
            <div className="section-header">
              <h2>Plateau de Jeu</h2>
              {puzzle && (
                <div className="board-info">
                  <span>{puzzle.width}×{puzzle.height}</span>
                  <span>{Object.keys(puzzle.vehicles).length} véhicules</span>
                </div>
              )}
            </div>
            
            <div className="game-board-container">
              {puzzle ? (
                <>
                  <div
                    className="game-board"
                    style={{
                      width: puzzle.width * cellSize,
                      height: puzzle.height * cellSize
                    }}
                  >
                    {/* Grille */}
                    {board.map((row, y) =>
                      row.map((cell, x) => (
                        <div
                          key={`${x}-${y}`}
                          className={`grid-cell ${cell === '#' ? 'wall-cell' : ''}`}
                          style={{
                            left: x * cellSize,
                            top: y * cellSize,
                            width: cellSize,
                            height: cellSize,
                          }}
                        />
                      ))
                    )}

                    {/* Sortie */}
                    <div
                      className="exit-arrow"
                      style={{
                        right: -cellSize / 3,
                        top: (Math.floor(puzzle.height / 2) - 1) * cellSize + cellSize / 2 - 15,
                        width: cellSize / 2,
                        height: cellSize / 2,
                      }}
                    >
                      🚪
                    </div>

                    {/* Véhicules */}
                    {Object.entries(puzzle.vehicles).map(([vid, data]) => {
                      const { x, y, orientation, length } = data;
                      const width = orientation === 'H' ? length * cellSize : cellSize;
                      const height = orientation === 'V' ? length * cellSize : cellSize;

                      return (
                        <div
                          key={vid}
                          className={getVehicleClass(vid)}
                          style={{
                            left: x * cellSize,
                            top: y * cellSize,
                            width,
                            height,
                            fontSize: `${cellSize / 3}px`
                          }}
                        >
                          {vid}
                        </div>
                      );
                    })}
                  </div>

                  {/* Message de victoire */}
                  {isGoal() && (
                    <div className="victory-message victory-animation">
                      <div className="victory-title">🎉 Félicitations !</div>
                      <div className="victory-subtitle">Puzzle résolu en {moveCount} mouvements</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-board">
                  <Upload size={64} className="empty-board-icon" />
                  <h3>Commencez par charger un puzzle</h3>
                  <p>Sélectionnez un fichier CSV pour démarrer le jeu</p>
                </div>
              )}
            </div>
          </div>

          {/* Panneau de contrôle */}
          <div className="control-panel">
            <div className="panel-header">
              <h2>Contrôles</h2>
              {puzzle && (
                <div className="move-counter">
                  <span className="move-count">{moveCount}</span>
                  <span>mouvements</span>
                </div>
              )}
            </div>

            {/* Upload Section */}
            <div className="control-section">
              <h3>Charger un Puzzle</h3>
              <label className="btn btn-file btn-large">
                <Upload size={20} />
                Sélectionner un fichier CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Game Controls */}
            {puzzle && (
              <div className="control-section">
                <h3>Actions du Jeu</h3>
                <div className="button-group">
                  <button
                    onClick={resetGame}
                    className="btn btn-secondary"
                  >
                    <RotateCcw size={18} />
                    Réinitialiser
                  </button>
                  
                  {solution && (
                    <>
                      <button
                        onClick={stepSolution}
                        disabled={solutionIndex >= solution.length}
                        className="btn btn-primary"
                      >
                        <Play size={18} />
                        Étape Suivante
                      </button>
                      
                      <button
                        onClick={() => setAutoPlay(!autoPlay)}
                        disabled={solutionIndex >= solution.length}
                        className={`btn ${autoPlay ? 'btn-danger' : 'btn-primary'}`}
                      >
                        {autoPlay ? <Pause size={18} /> : <Play size={18} />}
                        {autoPlay ? 'Pause' : 'Lecture Auto'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Solving Section */}
            {puzzle && (
              <div className="control-section">
                <h3>Résolution Automatique</h3>
                
                <div className="algorithm-selector">
                  <label>Algorithme :</label>
                  <select 
                    value={selectedAlgorithm} 
                    onChange={(e) => setSelectedAlgorithm(e.target.value)}
                    className="algorithm-select"
                  >
                    <option value="bfs">Breadth-First Search (BFS)</option>
                    <option value="astar_h1">A* Search (Heuristique 1)</option>
                    <option value="astar_h2">A* Search (Heuristique 2)</option>
                    <option value="astar_h3">A* Search (Heuristique 3)</option>
                  </select>
                </div>

                <button
                  onClick={() => solvePuzzle()}
                  disabled={solving || !apiConnected}
                  className="btn btn-success btn-large"
                >
                  <Zap size={20} />
                  {solving ? 'Résolution en cours...' : `Résoudre (${getAlgorithmName(selectedAlgorithm)})`}
                </button>

                {/* Progress Bar */}
                {solution && (
                  <div className="progress-section">
                    <div className="progress-info">
                      <span>Progression de la solution</span>
                      <span>{solutionIndex}/{solution.length}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message Display */}
            {message.text && (
              <div className={`message-container message-${message.type}`}>
                {message.text}
              </div>
            )}

            {/* Solution Info */}
            {solution && (
              <div className="solution-info">
                <h4>Solution Trouvée</h4>
                <p>{solution.length} mouvements avec {getAlgorithmName(selectedAlgorithm)}</p>
                <div className="next-move">
                  <strong>Prochain mouvement :</strong>
                  {solutionIndex < solution.length ? (
                    <code>{JSON.stringify(solution[solutionIndex])}</code>
                  ) : (
                    <span>Solution terminée</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        {puzzle && (
          <div className="stats-footer">
            <div className="stat-card">
              <span className="stat-label">Dimensions</span>
              <span className="stat-value">{puzzle.width} × {puzzle.height}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Véhicules</span>
              <span className="stat-value">{Object.keys(puzzle.vehicles).length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Murs</span>
              <span className="stat-value">{puzzle.walls.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Mouvements</span>
              <span className="stat-value highlight">{moveCount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RushHourGame;