// Core package dependencies configuration
const packageDependencies = {
    'nginx':       {
        repositories: [ 'deb https://nginx.org/packages/ubuntu/ focal nginx' ],
        keys:         [ 'https://nginx.org/keys/nginx_signing.key' ],
        packages:     []
    },
    'postgresql':  {
        repositories: [ 'deb http://apt.postgresql.org/pub/repos/apt focal-pgdg main' ],
        keys:         [ 'https://www.postgresql.org/media/keys/ACCC4CF8.asc' ],
        packages:     []
    },
    'mongodb-org': {
        repositories: [ 'deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse' ],
        keys:         [ 'https://www.mongodb.org/static/pgp/server-6.0.asc' ],
        packages:     []
    },
    'nodejs':      {
        repositories: [ 'deb https://deb.nodesource.com/node_20.x focal main' ],
        keys:         [ 'https://deb.nodesource.com/gpgkey/nodesource.gpg.key' ],
        packages:     []
    },
    'docker-ce':   {
        repositories: [ 'deb https://download.docker.com/linux/ubuntu focal stable' ],
        keys:         [ 'https://download.docker.com/linux/ubuntu/gpg' ],
        packages:     [ 'docker-ce', 'docker-ce-cli', 'containerd.io' ]
    }
};

// Module field definitions
const moduleFields = {
    apt:            [
        { name: 'name', type: 'text', label: 'Package Name' },
        { name: 'state', type: 'select', options: [ 'present', 'absent', 'latest' ], label: 'State' },
        { name: 'update_cache', type: 'select', options: [ 'yes', 'no' ], label: 'Update Cache' }
    ],
    apt_repository: [
        { name: 'repo', type: 'text', label: 'Repository URL' },
        { name: 'state', type: 'select', options: [ 'present', 'absent' ], label: 'State' },
        { name: 'filename', type: 'text', label: 'Source File Name' }
    ],
    apt_key:        [
        { name: 'url', type: 'text', label: 'Key URL' },
        { name: 'state', type: 'select', options: [ 'present', 'absent' ], label: 'State' }
    ],
    service:        [
        { name: 'name', type: 'text', label: 'Service Name' },
        { name: 'state', type: 'select', options: [ 'started', 'stopped', 'restarted' ], label: 'State' },
        { name: 'enabled', type: 'select', options: [ 'yes', 'no' ], label: 'Enabled at Boot' }
    ],
    command:        [
        { name: 'cmd', type: 'text', label: 'Command' }
    ],
    file:           [
        { name: 'path', type: 'text', label: 'Path' },
        { name: 'state', type: 'select', options: [ 'directory', 'touch', 'absent' ], label: 'State' },
        { name: 'mode', type: 'text', label: 'Mode' },
        { name: 'owner', type: 'text', label: 'Owner' },
        { name: 'group', type: 'text', label: 'Group' }
    ]
};

const repo = 'DevShedLabs/DeployPackages';

const presetCategories = {
    databases:  {
        name:  "Databases",
        url:   `https://cdn.jsdelivr.net/gh/${repo}@main/presets-databases.json`,
        purge: `https://purge.jsdelivr.net/gh/${repo}@main/presets-servers.json`
    },
    languages:  {
        name:  "Programming Languages",
        url:   `https://cdn.jsdelivr.net/gh/${repo}@main/presets-languages.json`,
        purge: `https://purge.jsdelivr.net/gh/${repo}@main/presets-languages.json`
    },
    webservers: {
        name:  "Web Servers",
        url:   `https://cdn.jsdelivr.net/gh/${repo}@main/presets-servers.json`,
        purge: `https://purge.jsdelivr.net/gh/${repo}@main/presets-servers.json`
    }
};

// Task Editor Component
function TaskEditor( { task, index, onUpdate, onRemove, tasks } ) {
    const getCurrentModule = () => {
        return Object.keys( task ).find( key => key !== 'name' );
    };

    const getDefaultParams = ( module ) => {
        switch ( module ) {
            case 'apt':
                return { name: '', state: 'present', update_cache: 'yes' };
            case 'apt_repository':
                return { repo: '', state: 'present', filename: '' };
            case 'apt_key':
                return { url: '', state: 'present' };
            case 'service':
                return { name: '', state: 'started', enabled: 'yes' };
            case 'file':
                return { path: '', state: 'directory', mode: '0755' };
            case 'command':
                return { cmd: '' };
            default:
                return {};
        }
    };

    const checkForDuplicatePackage = ( packageName ) => {
        return tasks.some( ( t, i ) =>
            i !== index &&
            t.apt &&
            t.apt.name === packageName
        );
    };

    const handleDependencies = ( packageName ) => {
        if ( packageDependencies[ packageName ] ) {
            const deps    = packageDependencies[ packageName ];
            const addDeps = window.confirm(
                `Would you like to add the recommended dependencies for ${packageName}?`
            );

            if ( addDeps ) {
                // Add repository keys first
                deps.keys.forEach( url => {
                    onUpdate( null, {
                        name:    `Add GPG key for ${packageName}`,
                        apt_key: { url, state: 'present' }
                    }, true );
                } );

                // Then add repositories
                deps.repositories.forEach( repo => {
                    onUpdate( null, {
                        name:           `Add repository for ${packageName}`,
                        apt_repository: {
                            repo,
                            state:    'present',
                            filename: packageName.split( '-' )[ 0 ]
                        }
                    }, true );
                } );

                // Finally add any additional required packages
                deps.packages.forEach( pkg => {
                    if ( !checkForDuplicatePackage( pkg ) ) {
                        onUpdate( null, {
                            name: `Install dependency ${pkg}`,
                            apt:  { name: pkg, state: 'present', update_cache: 'yes' }
                        }, true );
                    }
                } );
            }
        }
    };

    const updateTaskModule = ( module ) => {
        onUpdate( index, {
            name:       task.name,
            [ module ]: getDefaultParams( module )
        } );
    };

    const updateTaskParam = ( module, param, value ) => {
        if ( module === 'apt' && param === 'name' && value !== '' ) {
            if ( checkForDuplicatePackage( value ) ) {
                alert( `Package "${value}" is already in the task list!` );
                return;
            }
            handleDependencies( value );
        }

        onUpdate( index, {
            ...task,
            [ module ]: {
                ...task[ module ],
                [ param ]: value
            }
        } );
    };

    const currentModule = getCurrentModule();

    return (
        <div className="tasks-container">
            <div className="task-header">
                <input
                    type="text"
                    value={task.name}
                    onChange={( e ) => onUpdate( index, { ...task, name: e.target.value } )}
                    placeholder="Task name"
                />
                <button className="remove-task" onClick={() => onRemove( index )}>
                    Remove
                </button>
            </div>

            <div className="form-group">
                <label>Module:</label>
                <select
                    value={currentModule}
                    onChange={( e ) => updateTaskModule( e.target.value )}
                >
                    {Object.keys( moduleFields ).map( module => (
                        <option key={module} value={module}>
                            {module}
                        </option>
                    ) )}
                </select>
            </div>

            {currentModule && moduleFields[ currentModule ].map( field => (
                <div key={field.name} className="form-group">
                    <label>{field.label}:</label>
                    {field.type === 'select' ? (
                        <select
                            value={task[ currentModule ][ field.name ]}
                            onChange={( e ) => updateTaskParam( currentModule, field.name, e.target.value )}
                        >
                            {field.options.map( option => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ) )}
                        </select>
                    ) : (
                         <input
                             type={field.type}
                             value={task[ currentModule ][ field.name ]}
                             onChange={( e ) => updateTaskParam( currentModule, field.name, e.target.value )}
                         />
                     )}
                </div>
            ) )}
        </div>
    );
}

// Main Component
function AnsibleBuilder() {
    const [ playbookName, setPlaybookName ] = React.useState( 'my-playbook' );
    const [ hosts, setHosts ]               = React.useState( 'all' );
    const [ become, setBecome ]             = React.useState( true );
    const [ tasks, setTasks ]               = React.useState( [] );
    const [ copySuccess, setCopySuccess ]   = React.useState( false );
    const [ presets, setPresets ]           = React.useState( {} );
    const [ loading, setLoading ]           = React.useState( {} );
    const [ errors, setErrors ]             = React.useState( {} );
    const outputRef                         = React.useRef( null );

    React.useEffect( () => {
        Object.entries( presetCategories ).forEach( ( [ category ] ) => {
            loadPresetCategory( category );
        } );
    }, [] );

    React.useEffect( () => {
        if ( outputRef.current ) {
            Prism.highlightElement( outputRef.current );
        }
    }, [ tasks, playbookName, hosts, become ] );

    const loadPresetCategory = async ( category ) => {
        setLoading( prev => ( { ...prev, [ category ]: true } ) );
        try {
            const response = await fetch( presetCategories[ category ].url );

           // console.log( presetCategories[ category ].url );
            console.log( presetCategories[ category ].purge );

            if ( !response.ok ) throw new Error( `HTTP error! status: ${response.status}` );
            const categoryPresets = await response.json();
            setPresets( prev => ( { ...prev, [ category ]: categoryPresets } ) );
        } catch ( error ) {
            console.error( `Error loading ${category} presets:`, error );
            setErrors( prev => ( { ...prev, [ category ]: error.message } ) );
        } finally {
            setLoading( prev => ( { ...prev, [ category ]: false } ) );
        }
    };

    const addTask = ( task = null ) => {
        const newTask = task || {
            name: `task-${tasks.length + 1}`,
            apt:  { name: '', state: 'present', update_cache: 'yes' }
        };
        setTasks( [ ...tasks, newTask ] );
    };

    const removeTask = ( index ) => {
        setTasks( tasks.filter( ( _, i ) => i !== index ) );
    };

    const updateTask = ( index, updates, prepend = false ) => {
        if ( index === null && prepend ) {
            setTasks( [ updates, ...tasks ] );
        } else {
            const newTasks = [ ...tasks ];
            if ( index !== null ) {
                newTasks[ index ] = updates;
                setTasks( newTasks );
            }
        }
    };

    const applyPreset = ( preset ) => {
        const addedPackages = new Set();

        preset.tasks.forEach( task => {
            const module = Object.keys( task ).find( key => key !== 'name' );
            if ( module === 'apt' && task.apt.name ) {
                if ( !addedPackages.has( task.apt.name ) &&
                    !tasks.some( t => t.apt && t.apt.name === task.apt.name ) ) {
                    addedPackages.add( task.apt.name );
                    addTask( {
                        name:       task.name,
                        [ module ]: task[ module ]
                    } );
                }
            } else {
                addTask( {
                    name:       task.name,
                    [ module ]: task[ module ]
                } );
            }
        } );
    };

    const generatePlaybook = () => {
        const playbook = [ {
            name:  playbookName,
            hosts,
            become,
            tasks: tasks.map( task => ( {
                name: task.name,
                ...( Object.keys( task ).filter( key => key !== 'name' ).reduce( ( acc, key ) => ( {
                    ...acc,
                    [ key ]: task[ key ]
                } ), {} ) )
            } ) )
        } ];
        return jsyaml.dump( playbook );
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText( generatePlaybook() );
            setCopySuccess( true );
            setTimeout( () => setCopySuccess( false ), 2000 );
        } catch ( err ) {
            console.error( 'Failed to copy:', err );
        }
    };

    const renderPresetCategory = ( category ) => {
        const categoryData = presets[ category ];
        if ( !categoryData ) return null;

        return (
            <div key={category} className="category-container">
                <div className="category-title">{presetCategories[ category ].name}</div>
                <div className="preset-grid">
                    {Object.entries( categoryData ).map( ( [ key, preset ] ) => (
                        <button
                            key={key}
                            className="preset-btn"
                            onClick={() => applyPreset( preset )}
                        >
                            {preset.name}
                        </button>
                    ) )}
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="app-container">
                <div className="panel">
                    <h2>Configuration</h2>

                    <div className="form-group">
                        <label>Playbook Name:</label>
                        <input
                            type="text"
                            value={playbookName}
                            onChange={( e ) => setPlaybookName( e.target.value )}
                        />
                    </div>

                    <div className="form-group">
                        <label>Hosts:</label>
                        <input
                            type="text"
                            value={hosts}
                            onChange={( e ) => setHosts( e.target.value )}
                        />
                    </div>

                    <div className="form-group">
                        <label>Become (sudo):</label>
                        <select
                            value={become.toString()}
                            onChange={( e ) => setBecome( e.target.value === 'true' )}
                        >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </select>
                    </div>

                    <div className="preset-container">
                        <h3>Quick Start Templates</h3>
                        {Object.keys( presetCategories ).map( category =>
                            loading[ category ] ? (
                                <div key={category}>Loading {presetCategories[ category ].name}...</div>
                            ) : errors[ category ] ? (
                                <div key={category}>Error
                                    loading {presetCategories[ category ].name}: {errors[ category ]}</div>
                            ) : (
                                    renderPresetCategory( category )
                                )
                        )}
                    </div>

                    <div>
                        <h3>Tasks</h3>
                        <button className="add-task" onClick={() => addTask()}>
                            Add Task
                        </button>

                        {tasks.map( ( task, index ) => (
                            <TaskEditor
                                key={index}
                                task={task}
                                index={index}
                                onUpdate={updateTask}
                                onRemove={removeTask}
                                tasks={tasks}
                            />
                        ) )}
                    </div>
                </div>

                <div className="panel">
                    <h2>Generated Playbook</h2>
                    <pre>
                        <code ref={outputRef} className="language-yaml">
                            {generatePlaybook()}
                        </code>
                    </pre>
                    <button
                        className="copy-button"
                        onClick={copyToClipboard}
                    >
                        {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Render the app
const root = ReactDOM.createRoot( document.getElementById( 'root' ) );
root.render( <AnsibleBuilder /> );