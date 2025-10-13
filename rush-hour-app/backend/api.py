from flask import Flask, request, jsonify
from flask_cors import CORS
from tp1 import RushHourPuzzle, BFS, AStar, h1, h2, h3
import tempfile
import os
import traceback

app = Flask(__name__)
CORS(app)  # Permet à React de communiquer avec l'API


@app.route('/api/health', methods=['GET'])
def health_check():
    #Vérifie que l'API fonctionne
    return jsonify({'status': 'ok', 'message': 'API Rush Hour is running'})


@app.route('/api/parse-csv', methods=['POST'])
def parse_csv():
    #Parse un fichier CSV et retourne les données du puzzle
    try:
        data = request.json
        csv_content = data.get('csv') #recuperer csv 
        
        if not csv_content:
            return jsonify({'error': 'Aucun contenu CSV fourni'}), 400
        
        # Sauvegarder temporairement le CSV dans un fichier 
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            csv_path = f.name
        
        try:
            # Charger le puzzle
            puzzle = RushHourPuzzle()
            puzzle.setVehicles(csv_path)
            puzzle.setBoard()
            
            # Retourner les données du puzzle
            return jsonify({
                'success': True,
                'puzzle': {
                    'width': puzzle.board_width,
                    'height': puzzle.board_height,
                    'vehicles': puzzle.vehicles,
                    'walls': puzzle.walls
                }
            })
        finally:
            os.unlink(csv_path) #supprimer le fichier temporaire
    
    except Exception as e:
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/solve', methods=['POST'])
def solve_puzzle():
    """Résout le puzzle avec l'algorithme demandé"""
    try:
        data = request.json
        csv_content = data.get('csv')
        algorithm = data.get('algorithm', 'bfs')
        
        if not csv_content:
            return jsonify({'error': 'Aucun contenu CSV fourni'}), 400 
        
        print(f"🔍 Résolution avec {algorithm}...")
        
        # Sauvegarder temporairement le CSV
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            csv_path = f.name
        
        try:
            # Charger le puzzle
            puzzle = RushHourPuzzle()
            puzzle.setVehicles(csv_path)
            puzzle.setBoard()
            
            print(f"📊 Plateau: {puzzle.board_width}x{puzzle.board_height}")
            print(f"🚗 Véhicules: {len(puzzle.vehicles)}")
            
            # Résoudre selon l'algorithme
            goal_node = None
            
            if algorithm == 'bfs':
                print("⏳ Lancement de BFS...")
                goal_node = BFS(
                    s=puzzle,
                    successorsFn=lambda state: state.successorFunction(),
                    isGoal=lambda state: state.isGoal()
                )
            elif algorithm == 'astar_h1':
                print("⏳ Lancement de A* (h1)...")
                goal_node = AStar(
                    s=puzzle,
                    successorsFn=lambda state: state.successorFunction(),
                    isGoal=lambda state: state.isGoal(),
                    h=h1
                )
            elif algorithm == 'astar_h2':
                print("⏳ Lancement de A* (h2)...")
                goal_node = AStar(
                    s=puzzle,
                    successorsFn=lambda state: state.successorFunction(),
                    isGoal=lambda state: state.isGoal(),
                    h=h2
                )
            elif algorithm == 'astar_h3':
                print("⏳ Lancement de A* (h3)...")
                goal_node = AStar(
                    s=puzzle,
                    successorsFn=lambda state: state.successorFunction(),
                    isGoal=lambda state: state.isGoal(),
                    h=h3
                )
            else:
                return jsonify({'error': f'Algorithme inconnu: {algorithm}'}), 400
            
            if goal_node:
                solution = goal_node.getSolution()
                print(f"✅ Solution trouvée! {len(solution)} mouvements")
                
                return jsonify({
                    'success': True,
                    'solution': solution,
                    'moves': len(solution),
                    'algorithm': algorithm
                })
            else:
                print("❌ Aucune solution trouvée")
                return jsonify({
                    'success': False,
                    'error': 'Aucune solution trouvée'
                })
        
        finally:
            # Nettoyer le fichier temporaire
            if os.path.exists(csv_path):
                os.unlink(csv_path)
    
    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/validate-move', methods=['POST'])
def validate_move():
    """Valide un mouvement manuel"""
    try:
        data = request.json
        csv_content = data.get('csv')
        vehicle_id = data.get('vehicleId')
        direction = data.get('direction')
        
        # Sauvegarder temporairement le CSV
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            csv_path = f.name
        
        try:
            # Charger le puzzle
            puzzle = RushHourPuzzle()
            puzzle.setVehicles(csv_path)
            puzzle.setBoard()
            
            # Obtenir tous les mouvements possibles
            successors = puzzle.successorFunction()
            
            # Chercher le mouvement demandé
            for action, new_state in successors:
                if action[0] == vehicle_id and action[1] == direction:
                    return jsonify({
                        'valid': True,
                        'step': action[2] if len(action) > 2 else 1
                    })
            
            return jsonify({'valid': False})
        
        finally:
            os.unlink(csv_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("🚀 Démarrage de l'API Rush Hour...")
    print("📍 API disponible sur: http://localhost:5000")
    print("🔍 Endpoints disponibles:")
    print("   - GET  /api/health")
    print("   - POST /api/parse-csv")
    print("   - POST /api/solve")
    print("   - POST /api/validate-move")
    print("\n✅ Appuyez sur Ctrl+C pour arrêter\n")
    
    app.run(debug=True, port=5000, host='0.0.0.0')